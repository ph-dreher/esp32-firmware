/* esp32-firmware
 * Copyright (C) 2023 Mattias Schäffersmann <mattias@tinkerforge.com>
 * Copyright (C) 2024 Matthias Bolte <matthias@tinkerforge.com>
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

#pragma once

#include "generic_modbus_tcp_client.h"

#include <stdint.h>

#include "config.h"
#include "modules/meters/imeter.h"
#include "meters_modbus_tcp.h"
#include "meters_modbus_tcp_defs.h"

#if defined(__GNUC__)
    #pragma GCC diagnostic push
    #include "gcc_warnings.h"
    #pragma GCC diagnostic ignored "-Weffc++"
#endif

class MeterModbusTCP final : protected GenericModbusTCPClient, public IMeter
{
public:
    enum class ValueType : uint8_t {
        U16 = 11,
        S16 = 21,
        U32 = 32,
        S32 = 42,
    };

    struct ValueSpec {
        const char *name;
        size_t start_address;
        ValueType value_type;
        float scale_factor;
    };

    struct ValueTable {
        const ValueSpec *specs;
        size_t specs_length;
        const MeterValueID *ids;
        size_t ids_length;
        const uint32_t *index;
    };

    MeterModbusTCP(uint32_t slot_, Config *state_, Config *errors_, ModbusTCP *mb_) : GenericModbusTCPClient(mb_), slot(slot_), state(state_), errors(errors_) {}

    [[gnu::const]] MeterClassID get_class() const override;
    void setup(const Config &ephemeral_config) override;

    bool supports_power()         override {return true;}
    bool supports_energy_import() override {return true;}
    bool supports_energy_imexsum()override {return true;}
    bool supports_energy_export() override {return true;}
    bool supports_currents()      override {return true;}

    void read_done_callback();

private:
    void connect_callback() override;
    void disconnect_callback() override;
    bool prepare_read();
    bool is_sungrow_inverter_meter() const;
    bool is_sungrow_grid_meter() const;
    bool is_sungrow_battery_meter() const;

    uint32_t slot;
    Config *state;
    Config *errors;

    MeterModbusTCPTableID table_id;
    const ValueTable *table;

    bool read_allowed = false;
    bool values_declared = false;
    size_t read_index = 0;

    uint16_t register_buffer[2];

    SungrowHybridInverterVirtualMeterID sungrow_hybrid_inverter_virtual_meter;
    SungrowStringInverterVirtualMeterID sungrow_string_inverter_virtual_meter;
    int sungrow_inverter_output_type = -1;
    uint16_t sungrow_hybrid_inverter_running_state;

    SolarmaxMaxStorageVirtualMeterID solarmax_max_storage_virtual_meter;
};

#if defined(__GNUC__)
    #pragma GCC diagnostic pop
#endif
