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

#include "meter_class_defs.h"
#include "meter_class_none.h"

#include "gcc_warnings.h"

// for MeterGenerator
_ATTRIBUTE((const))
IMeter * MeterGeneratorNone::new_meter(uint32_t slot, Config *state, const Config *config)
{
    return this;
}

const Config * MeterGeneratorNone::get_config_prototype()
{
    return config_prototype;
}

const Config * MeterGeneratorNone::get_state_prototype()
{
    return state_prototype;
}

// for both
_ATTRIBUTE((const))
uint32_t MeterGeneratorNone::get_class() const
{
    return METER_CLASS_NONE;
}