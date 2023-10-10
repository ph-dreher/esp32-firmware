/* esp32-firmware
 * Copyright (C) 2023 Mattias Schäffersmann <mattias@tinkerforge.com>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 */

#include "meter_modbus_tcp.h"
#include "modbus_tcp_tools.h"
#include "module_dependencies.h"

#include <errno.h>
#include <string.h>

#include "event_log.h"
//#include "modules/meters/meter_value_id.h"
#include "task_scheduler.h"
#include "tools.h"

#include "gcc_warnings.h"

_ATTRIBUTE((const))
MeterClassID MeterModbusTCP::get_class() const
{
    return MeterClassID::ModbusTCP;
}

void MeterModbusTCP::setup()
{
    host_name = config->get("host")->asString();
    port      = static_cast<uint16_t>(config->get("port")->asUint());
    address   = static_cast<uint8_t>(config->get("address")->asUint());

    register_buffer = static_cast<uint16_t *>(malloc(register_buffer_size * sizeof(uint16_t)));

    task_scheduler.scheduleOnce([this](){
        this->start_connection();
    }, 0);
}

void MeterModbusTCP::start_connection()
{
    host_data.user = this;

    dns_gethostbyname_addrtype_lwip_ctx_async(host_name.c_str(), [](dns_gethostbyname_addrtype_lwip_ctx_async_data *data) {
        MeterModbusTCP *mmbt = static_cast<MeterModbusTCP *>(data->user);

        mmbt->check_ip(data->addr_ptr, data->err);
    }, &host_data, LWIP_DNS_ADDRTYPE_IPV4);
}

void MeterModbusTCP::check_ip(const ip_addr_t *ip, int err)
{
    if (err != ERR_OK || !ip || ip->type != IPADDR_TYPE_V4) {
        if (!resolve_error_printed) {
            if (err == ERR_VAL) {
                logger.printfln("meter_modbus_tcp: Meter configured with hostname '%s', but no DNS server is configured!", host_name.c_str());
            } else {
                logger.printfln("modbus_meter_tcp: Couldn't resolve hostname '%s', error %i", host_name.c_str(), err);
            }
            resolve_error_printed = true;
        }

        task_scheduler.scheduleOnce([this](){
            this->start_connection();
        }, 10 * 1000);

        return;
    }
    resolve_error_printed = false;

    host_ip = ip->u_addr.ip4.addr;

    errno = ENOTRECOVERABLE; // Set to something known because connect() might leave errno unchanged on some errors.
    if (!mb->connect(host_ip)) {
        if (!connect_error_printed) {
            if (errno == EINPROGRESS) { // WiFiClient::connect() doesn't set errno and incorrectly returns EINPROGRESS despite being blocking.
                logger.printfln("meter_modbus_tcp: Connection to '%s' failed.", host_name.c_str());
            } else {
                logger.printfln("meter_modbus_tcp: Connection to '%s' failed: %s (%i)", host_name.c_str(), strerror(errno), errno);
            }
            connect_error_printed = true;
        }

        task_scheduler.scheduleOnce([this](){
            this->start_connection();
        }, connect_backoff_ms);

        connect_backoff_ms *= 2;
        if (connect_backoff_ms > 16000) {
            connect_backoff_ms = 16000;
        }
    } else {
        connect_backoff_ms = 1000;
        connect_error_printed = false;
        logger.printfln("meter_modbus_tcp: Connected to '%s'", host_name.c_str());
    }

    poll_state = PollState::Single;
    poll_count = 0;
    all_start = now_us();
    worst_runtime = 0;
    best_runtime = UINT32_MAX;

    poll_next();
}

void MeterModbusTCP::poll_next()
{
    uint16_t offset;
    uint16_t numregs;

    if (poll_state == PollState::Single) {
        offset = static_cast<uint16_t>(40000 + poll_count);
        numregs = 1;
    } else if (poll_state == PollState::Combined) {
        offset = 40000;
        numregs = poll_count;
    } else {
        return;
    }

    request_start = now_us();
    uint16_t ret = mb->readHreg(host_ip, offset, register_buffer, numregs, [this](Modbus::ResultCode result_code, uint16_t transaction_id, void *data)->bool {
        if (result_code != Modbus::ResultCode::EX_SUCCESS) {
            logger.printfln("meter_modbus_tcp: readHreg failed: %s (0x%02x)", get_modbus_result_code_name(result_code), static_cast<uint32_t>(result_code));
            this->start_connection();
            return false;
        }
        if (data) {
            logger.printfln("meter_modbus_tcp: data is %p", data);
        }
        this->handle_data();
        return true;
    });
    if (ret == 0) {
        logger.printfln("meter_modbus_tcp: readHreg failed");
        start_connection();
    }
    //logger.printfln("meter_modbus_tcp: Requested %u registers from offset %u, returned %u", numregs, offset, ret);
}

void MeterModbusTCP::handle_data()
{
    uint32_t runtime32 = static_cast<uint32_t>(static_cast<int64_t>(now_us() - request_start));

    if (poll_state == PollState::Single) {
        if (runtime32 > worst_runtime) {
            worst_runtime = runtime32;
        }
        if (runtime32 < best_runtime) {
            best_runtime = runtime32;
        }
        poll_count++;
        if (poll_count >= register_buffer_size) {
            uint32_t total_runtime = static_cast<uint32_t>(static_cast<int64_t>(now_us() - all_start));
            uint32_t avg_runtime = total_runtime / register_buffer_size;
            logger.printfln("meter_modbus_tcp: Single run done: avg=%u best=%u worst=%u", avg_runtime, best_runtime, worst_runtime);

            poll_state = PollState::Combined;
            poll_count = 1;
        }
    } else if (poll_state == PollState::Combined) {
        if (runtime32 > worst_runtime) {
            worst_runtime = runtime32;
            logger.printfln("meter_modbus_tcp: New worst runtime: %u", runtime32);
        }
        if (runtime32 < best_runtime) {
            best_runtime = runtime32;
            logger.printfln("meter_modbus_tcp: New best runtime: %u", runtime32);
        }

        if (runtime32 > 50000) { // 50ms
            logger.printfln("meter_modbus_tcp: Long runtime: %u", runtime32);
        }

        logger.printfln("meter_modbus_tcp: Combined run with %u values: %u us", poll_count, runtime32);

        poll_count++;
        if (poll_count > register_buffer_size) {
            poll_state = PollState::Done;
            poll_count = 0;
        }
    } else {
        logger.printfln("meter_modbus_tcp: Shouldn't be here.");
        return;
    }
    poll_next();
}