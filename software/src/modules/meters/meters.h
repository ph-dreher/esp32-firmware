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

#pragma once

#include "imeter.h"
#include "meter_class_defs.h"
#include "meter_generator.h"

#include <stdint.h>

#include "config.h"
#include "module.h"

#if defined(__GNUC__)
    #pragma GCC diagnostic push
    #include "gcc_warnings.h"
    #pragma GCC diagnostic ignored "-Weffc++"
#endif

#define METER_SLOTS 7

class Meters final : public IModule
{
public:
    Meters(){}
    void pre_setup() override;
    void setup() override;
    void register_urls() override;

    void register_meter_generator(uint32_t meter_class, MeterGenerator *generator);
    IMeter *get_meter(uint32_t slot);
    uint32_t get_meters(uint32_t meter_class, IMeter **found_meters, uint32_t found_meters_capacity);

    void update_value(uint32_t slot, uint32_t index, float new_value);
    void update_all_values(uint32_t slot, const float new_values[]);
    void declare_value_ids(uint32_t slot, const uint32_t value_ids[], uint32_t value_count);

private:
    MeterGenerator *get_generator_for_class(uint32_t meter_class);
    IMeter *new_meter_of_class(uint32_t meter_class, uint32_t slot, Config *state, const Config *config);

    ConfigRoot config_unions[METER_SLOTS];
    ConfigRoot states[METER_SLOTS];

    ConfigRoot slots_value_ids[METER_SLOTS];
    ConfigRoot slots_values[METER_SLOTS];

    ConfigRoot config_float_nan_prototype;
    ConfigRoot config_uint_max_prototype;

    std::vector<std::tuple<uint32_t, MeterGenerator *>> generators;
    IMeter *meters[METER_SLOTS];
};

#if defined(__GNUC__)
    #pragma GCC diagnostic pop
#endif