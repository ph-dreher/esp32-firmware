/* esp32-firmware
 * Copyright (C) 2023 Frederic Henrichs <frederic@tinkerforge.com>
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

#include "coredump.h"

#include "build.h"
#include "api.h"
#include "tools.h"

#include "LittleFS.h"

#include "esp_core_dump.h"

#define TF_COREDUMP_DATA_BUFF_SIZE 500

//Buffer size of 555 Bytes so that we have a buffer size of 500 + 55 pre + postfix.
COREDUMP_DRAM_ATTR char tf_coredump_data[TF_COREDUMP_DATA_BUFF_SIZE];

void Coredump::pre_setup()
{
    coredump_state = Config::Object({
        {"coredump_available", Config::Bool(false)}
    });
}

void Coredump::setup()
{
    if (esp_core_dump_image_check() == ESP_OK)
        coredump_state.get("coredump_available")->updateBool(true);
}

void Coredump::register_urls()
{
    api.addState("coredump/state", &coredump_state, {}, 1000);

    String tf_coredump_prefix = "___tf_coredump_data_start___";
    String tf_coredump_postfix = "___tf_coredump_data_end___";

    DynamicJsonDocument tf_coredump_json(500);

    tf_coredump_json["firmware_version"] = build_version_full_str();

    String coredump_json;

    serializeJson(tf_coredump_json, coredump_json);

    String tf_coredump_string = tf_coredump_prefix + coredump_json + tf_coredump_postfix;

    if (tf_coredump_string.length() >= TF_COREDUMP_DATA_BUFF_SIZE)
        esp_system_abort("Coredump data is too big for buffer");

    memcpy(tf_coredump_data, tf_coredump_string.c_str(), tf_coredump_string.length());

    server.on("/coredump/erase", HTTP_GET, [this](WebServerRequest request) {
        esp_core_dump_image_erase();
        if (esp_core_dump_image_check() == ESP_OK)
            return request.send(503, "text/plain", "Error while erasing core dump");

        coredump_state.get("coredump_available")->updateBool(false);
        return request.send(200);
    });

    server.on("/coredump/coredump.elf", HTTP_GET, [this](WebServerRequest request) {
        if (esp_core_dump_image_check() != ESP_OK)
            return request.send(404);

        auto buffer = heap_caps_calloc_prefer(4096, 1, MALLOC_CAP_32BIT | MALLOC_CAP_INTERNAL, MALLOC_CAP_8BIT | MALLOC_CAP_INTERNAL);
        defer {free(buffer);};

        if (!buffer)
            return request.send(503, "text/plain", "Out of memory");

        esp_core_dump_summary_t summary;
        if (esp_core_dump_get_summary(&summary) != ESP_OK)
            return request.send(503, "text/plain", "Failed to get core dump summary");

        size_t addr;
        size_t size;
        if (esp_core_dump_image_get(&addr, &size) != ESP_OK)
            return request.send(503, "text/plain", "Failed to get core dump image size");

        request.beginChunkedResponse(200, "application/octet-stream");

        for (size_t i = 0; i < size; i += 4096)
        {
            size_t to_send = min((size_t)4096, size - i);
            if (esp_flash_read(NULL, buffer, addr + i, to_send) != ESP_OK) {
                String s = "ESP_FLASH_READ failed. Core dump truncated";
                request.sendChunk(s.c_str(), s.length());
                return request.endChunkedResponse();
            }
            request.sendChunk((char *)buffer + (i == 0 ? 20 : 0), to_send - (i == 0 ? 20 : 0));
        }

        return request.endChunkedResponse();
    });
}

void Coredump::loop() {}