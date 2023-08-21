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

#include "meters.h"
#include "meter_class_none.h"

#include "api.h"
#include "event_log.h"
#include "tools.h"

#include "gcc_warnings.h"

static MeterGeneratorNone meter_generator_none;

static void init_uint32_array(uint32_t *arr, size_t len, uint32_t val)
{
    if (len <= 0)
        return;

    uint32_t *arr_end = arr + len;
    do {
        *arr++ = val;
    } while (arr < arr_end);
}

void Meters::pre_setup()
{
    init_uint32_array(index_cache_power, sizeof(index_cache_power) / sizeof(index_cache_power[0]), UINT32_MAX);
    init_uint32_array(reinterpret_cast<uint32_t *>(index_cache_energy), sizeof(index_cache_energy) / sizeof(index_cache_energy[0][0]), UINT32_MAX);
    init_uint32_array(reinterpret_cast<uint32_t *>(index_cache_currents), sizeof(index_cache_currents) / sizeof(index_cache_currents[0][0]), UINT32_MAX);

    generators.reserve(METER_CLASSES);
    register_meter_generator(METER_CLASS_NONE, &meter_generator_none);

    config_float_nan_prototype = Config::Float(NAN);
    config_uint_max_prototype  = Config::Uint32(UINT32_MAX);

    for (uint32_t slot = 0; slot < METERS_SLOTS; slot++) {
        slots_value_ids[slot] = Config::Array({},
            &config_uint_max_prototype,
            0, UINT16_MAX - 1, Config::type_id<Config::ConfUint>()
        );
        slots_values[slot] = Config::Array({},
            &config_float_nan_prototype,
            0, UINT16_MAX - 1, Config::type_id<Config::ConfFloat>()
        );
    }
}

void Meters::setup()
{
    generators.shrink_to_fit();

    // Create config prototypes, depending on available generators.
    uint8_t class_count = static_cast<uint8_t>(generators.size());
    ConfUnionPrototype *config_prototypes = new ConfUnionPrototype[class_count];

    for (uint32_t i = 0; i < class_count; i++) {
        const auto &generator_tuple = generators[i];
        uint8_t meter_class = static_cast<uint8_t>(std::get<0>(generator_tuple));
        auto meter_generator = std::get<1>(generator_tuple);
        config_prototypes[i] = {meter_class, *meter_generator->get_config_prototype()};
    }

    for (uint32_t slot = 0; slot < METERS_SLOTS; slot++) {
        // Initialize config.
        config_unions[slot] = Config::Union(
            *get_generator_for_class(METER_CLASS_NONE)->get_config_prototype(),
            METER_CLASS_NONE,
            config_prototypes,
            class_count
        );

        // Load config.
        char path_buf[32];
        snprintf(path_buf, ARRAY_SIZE(path_buf), "meters/_%u_config", slot);
        api.restorePersistentConfig(path_buf, &config_unions[slot]);

        uint32_t configured_meter_class = config_unions[slot].getTag();

        // Generator might be a NONE class generator if the requested class is not available.
        MeterGenerator *generator = get_generator_for_class(configured_meter_class);

        // Initialize state to match (loaded) config.
        states[slot] = *generator->get_state_prototype();

        // Create meter from config.
        const Config *meter_conf = static_cast<const Config *>(config_unions[slot].get());
        Config *meter_state = &states[slot];

        IMeter *meter = new_meter_of_class(configured_meter_class, slot, meter_state, meter_conf);
        if (!meter) {
            logger.printfln("meters: Failed to create meter of class %u.", configured_meter_class);
            continue;
        }
        meter->setup();
        meters[slot] = meter;
    }

    api.addFeature("meters");
    initialized = true;
}

void Meters::register_urls()
{
    char path_buf[32];

    for (uint32_t slot = 0; slot < METERS_SLOTS; slot++) {
        snprintf(path_buf, ARRAY_SIZE(path_buf), "meters/_%u_config", slot);
        api.addPersistentConfig(path_buf, &config_unions[slot], {}, 1000);

        snprintf(path_buf, ARRAY_SIZE(path_buf), "meters/_%u_state", slot);
        api.addState(path_buf, &states[slot], {}, 1000);

        snprintf(path_buf, ARRAY_SIZE(path_buf), "meters/_%u_value_ids", slot);
        api.addState(path_buf, &slots_value_ids[slot], {}, 1000);

        snprintf(path_buf, ARRAY_SIZE(path_buf), "meters/_%u_values", slot);
        api.addState(path_buf, &slots_values[slot], {}, 1000);

        if (meters[slot]) {
            snprintf(path_buf, ARRAY_SIZE(path_buf), "meters/_%u_", slot);
            meters[slot]->register_urls(path_buf);
        }
    }
}

void Meters::register_meter_generator(uint32_t meter_class, MeterGenerator *generator)
{
    for (const auto &generator_tuple : generators) {
        uint32_t known_class = std::get<0>(generator_tuple);
        if (meter_class == known_class) {
            logger.printfln("meters: Tried to register meter generator for already registered meter class %u.", meter_class);
            return;
        }
    }

    generators.push_back({meter_class, generator});
}

MeterGenerator *Meters::get_generator_for_class(uint32_t meter_class)
{
    for (auto generator_tuple : generators) {
        uint32_t known_class = std::get<0>(generator_tuple);
        if (meter_class == known_class) {
            return std::get<1>(generator_tuple);
        }
    }

    if (meter_class == METER_CLASS_NONE) {
        logger.printfln("meters: No generator for dummy meter available. This is probably fatal.");
        return nullptr;
    }

    logger.printfln("meters: No generator for meter class %u.", meter_class);
    return get_generator_for_class(METER_CLASS_NONE);
}

IMeter *Meters::new_meter_of_class(uint32_t meter_class, uint32_t slot, Config *state, const Config *config)
{
    MeterGenerator *generator = get_generator_for_class(meter_class);

    if (!generator)
        return nullptr;

    return generator->new_meter(slot, state, config);
}

IMeter *Meters::get_meter(uint32_t slot)
{
    if (slot >= METERS_SLOTS)
        return nullptr;

    return meters[slot];
}

uint32_t Meters::get_meters(uint32_t meter_class, IMeter **found_meters, uint32_t found_meters_capacity)
{
    uint32_t found_count = 0;
    for (uint32_t i = 0; i < ARRAY_SIZE(meters); i++) {
        if (meters[i]->get_class() == meter_class) {
            if (found_count < found_meters_capacity) {
                found_meters[found_count] = meters[i];
            }
            found_count++;
        }
    }
    return found_count;
}

bool Meters::meter_supports_power(uint32_t slot)
{
    if (slot >= METERS_SLOTS)
        return false;

    return meters[slot]->supports_power();
}

bool Meters::meter_supports_energy(uint32_t slot)
{
    if (slot >= METERS_SLOTS)
        return false;

    return meters[slot]->supports_energy();
}

bool Meters::meter_supports_currents(uint32_t slot)
{
    if (slot >= METERS_SLOTS)
        return false;

    return meters[slot]->supports_currents();
}

bool Meters::get_power(uint32_t slot, float *power)
{
    if (slot >= METERS_SLOTS)
        return false;

    uint32_t power_index = index_cache_power[slot];
    Config *val = static_cast<Config *>(slots_values[slot].get(static_cast<uint16_t>(power_index)));

    if (!val)
        return false;

    *power = val->asFloat();
    return true;
}

uint32_t Meters::get_single_energy(uint32_t slot, uint32_t kind, float *energy)
{
    // No parameter checks for slot and kind because this function is private.

    uint32_t energy_index = index_cache_energy[slot][kind];
    Config *val = static_cast<Config *>(slots_values[slot].get(static_cast<uint16_t>(energy_index)));

    if (val) {
        *energy = val->asFloat();
        return 1;
    } else {
        *energy = NAN;
        return 0;
    }
}

uint32_t Meters::get_energy(uint32_t slot, float *total_import, float *total_export)
{
    if (slot >= METERS_SLOTS)
        return 0;

    uint32_t found_values = 0;
    found_values += get_single_energy(slot, INDEX_CACHE_ENERGY_IMPORT, total_import);
    found_values += get_single_energy(slot, INDEX_CACHE_ENERGY_EXPORT, total_export);

    return found_values;
}

uint32_t Meters::get_currents(uint32_t slot, float currents[INDEX_CACHE_CURRENT_COUNT])
{
    if (slot >= METERS_SLOTS)
        return 0;

    uint32_t found_N_values = 0;
    uint32_t found_L_values = 0;
    for (uint32_t i = 0; i < INDEX_CACHE_CURRENT_COUNT; i++) {
        uint32_t current_index = index_cache_currents[slot][i];
        Config *val = static_cast<Config *>(slots_values[slot].get(static_cast<uint16_t>(current_index)));

        if (val) {
            currents[i] = val->asFloat();
            if (i == INDEX_CACHE_CURRENT_N) {
                found_N_values++;
            } else {
                found_L_values++;
            }
        } else {
            currents[i] = NAN;
        }
    }

    if (found_L_values == 3) {
        if (found_N_values == 1) {
            return 4;
        } else {
            return 3;
        }
    } else {
        if (found_N_values == 1) {
            return 1;
        } else {
            return 0;
        }
    }
}

void Meters::update_value(uint32_t slot, uint32_t index, float new_value)
{
    if (slot >= METERS_SLOTS) {
        logger.printfln("meters: Tried to update value %u for meter in non-existent slot %u.", index, slot);
        return;
    }

    slots_values[slot].get(static_cast<uint16_t>(index))->updateFloat(new_value);
    //TODO: Update value age.
}

void Meters::update_all_values(uint32_t slot, const float new_values[])
{
    if (slot >= METERS_SLOTS) {
        logger.printfln("meters: Tried to update all values for meter in non-existent slot %u.", slot);
        return;
    }

    Config &values = slots_values[slot];
    auto value_count = values.count();

    for (uint16_t i = 0; i < value_count; i++) {
        if (!isnan(new_values[i])) {
            auto wrap = values.get(i);
            auto old_value = wrap->asFloat();
            bool changed = wrap->updateFloat(new_values[i]) && !isnan(old_value);
            (void)changed;
            //TODO: Update value age.
        }
    }
}

void Meters::declare_value_ids(uint32_t slot, const MeterValueID new_value_ids[], uint32_t value_id_count)
{
    Config &value_ids = slots_value_ids[slot];
    Config &values    = slots_values[slot];

    if (value_ids.count() != 0) {
        logger.printfln("meters: Meter in slot %u already declared %i values. Refusing to re-declare %u values.", slot, value_ids.count(), value_id_count);
        return;
    }

    for (uint16_t i = 0; i < static_cast<uint16_t>(value_id_count); i++) {
        auto val = value_ids.add();
        val->updateUint(static_cast<uint32_t>(new_value_ids[i]));

        values.add();
    }

    index_cache_power[slot]                             = meters_find_id_index(new_value_ids, value_id_count, MeterValueID::PowerActiveLSumImExDiff);
    index_cache_energy[slot][INDEX_CACHE_ENERGY_IMPORT] = meters_find_id_index(new_value_ids, value_id_count, MeterValueID::EnergyActiveLSumImport);
    index_cache_energy[slot][INDEX_CACHE_ENERGY_EXPORT] = meters_find_id_index(new_value_ids, value_id_count, MeterValueID::EnergyActiveLSumExport);
    index_cache_currents[slot][INDEX_CACHE_CURRENT_N  ] = meters_find_id_index(new_value_ids, value_id_count, MeterValueID::CurrentNImport);
    index_cache_currents[slot][INDEX_CACHE_CURRENT_L1 ] = meters_find_id_index(new_value_ids, value_id_count, MeterValueID::CurrentL1Import);
    index_cache_currents[slot][INDEX_CACHE_CURRENT_L2 ] = meters_find_id_index(new_value_ids, value_id_count, MeterValueID::CurrentL2Import);
    index_cache_currents[slot][INDEX_CACHE_CURRENT_L3 ] = meters_find_id_index(new_value_ids, value_id_count, MeterValueID::CurrentL3Import);

    logger.printfln("meters: Meter in slot %u declared %u values.", slot, value_id_count);
}

bool Meters::get_cached_power_index(uint32_t slot, uint32_t *index)
{
    *index = index_cache_power[slot];
    return index_cache_power[slot] != UINT32_MAX;
}

uint32_t meters_find_id_index(const MeterValueID value_ids[], uint32_t value_id_count, MeterValueID id)
{
    for (uint32_t i = 0; i < value_id_count; i++) {
        if (value_ids[i] == id)
            return i;
    }
    return UINT32_MAX;
}
