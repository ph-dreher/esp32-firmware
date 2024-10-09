/** @jsxImportSource preact */
import { h } from "preact";
let x = {
    "meters_modbus_tcp": {
        "status": {
        },
        "navbar": {
        },
        "content": {
            "meter_class": "Modbus/TCP",

            "display_name": "Display name",
            "host": "Host",
            "host_invalid": "Host is invalid",
            "port": "Port",
            "port_muted": "typically 502",
            "table": "Register table",
            "table_select": "Select...",
            "table_custom": "Custom",
            "table_sungrow_hybrid_inverter": "Sungrow Hybrid Inverter (SH...)",
            "table_sungrow_string_inverter": "Sungrow String Inverter (SG...)",
            "table_solarmax_max_storage": "Solarmax Max.Storage",
            "table_victron_energy_gx": "Victron Energy GX",
            "table_deye_hybrid_inverter": "Deye Hybrid Inverter",
            "table_alpha_ess_hybrid_inverter": "Alpha ESS Hybrid Inverter",
            "table_shelly_pro_em": "Shelly Pro EM",
            "table_shelly_pro_3em": "Shelly Pro 3EM",
            "table_siemens_pac2200": "Siemens PAC2200",
            "table_siemens_pac3120": "Siemens PAC3120",
            "table_siemens_pac3200": "Siemens PAC3200",
            "table_siemens_pac3220": "Siemens PAC3220",
            "table_siemens_pac4200": "Siemens PAC4200",
            "table_siemens_pac4220": "Siemens PAC4220",
            "virtual_meter": "Virtual meter",
            "virtual_meter_select": "Select...",
            "virtual_meter_inverter": "Inverter",
            "virtual_meter_grid": "Grid",
            "virtual_meter_battery": "Battery",
            "virtual_meter_load": "Load",
            "device_address": "Device address",
            "device_address_muted": /*SFN*/(device_address: number) => "typically " + device_address/*NF*/,
            "shelly_pro_3em_device_profile": "Device profile",
            "shelly_pro_3em_device_profile_triphase": "Triphase",
            "shelly_pro_3em_device_profile_monophase": "Monophase",
            "shelly_em_monophase_channel": "Channel",
            "shelly_em_monophase_channel_select": "Select...",
            "shelly_em_monophase_channel_1": "1",
            "shelly_em_monophase_channel_2": "2",
            "shelly_em_monophase_channel_3": "3",
            "shelly_em_monophase_mapping": "Mapping",
            "shelly_em_monophase_mapping_select": "Select...",
            "shelly_em_monophase_mapping_l1": "L1",
            "shelly_em_monophase_mapping_l2": "L2",
            "shelly_em_monophase_mapping_l3": "L3",
            "register_address_mode": "Address mode",
            "register_address_mode_select": "Select...",
            "register_address_mode_address": "Register address (begins at 0)",
            "register_address_mode_number": "Register number (begins at 1)",
            "registers": "Registers",
            "registers_add_title": "Add register",
            "registers_add_count": /*SFN*/(x: number, max: number) => x + " of " + max + " registers configured"/*NF*/,
            "registers_add_select_address_mode": "Select address mode first...",
            "registers_edit_title": "Edit register",
            "registers_register": /*SFN*/(start_address: number, value_id_name: string) => start_address + " as " + value_id_name/*NF*/,
            "registers_register_type": "Register type",
            "registers_register_type_select": "Select...",
            "registers_register_type_holding_register": "Holding register",
            "registers_register_type_input_register": "Input register",
            "registers_start_address": "Start address",
            "registers_start_address_muted": "begins at 0",
            "registers_start_number": "Start number",
            "registers_start_number_muted": "begins at 1",
            "registers_value_type": "Value type",
            "registers_value_type_select": "Select...",
            "registers_value_type_u16": "One register, 16-bit, integer, unsigned",
            "registers_value_type_s16": "One register, 16-bit, integer, signed",
            "registers_value_type_u32be": "Two registers, 32-bit, integer, unsigned, big-endian",
            "registers_value_type_u32le": "Two registers, 32-bit, integer, unsigned, little-endian",
            "registers_value_type_s32be": "Two registers, 32-bit, integer, signed, big-endian",
            "registers_value_type_s32le": "Two registers, 32-bit, integer, signed, little-endian",
            "registers_value_type_f32be": "Two registers, 32-bit, float, big-endian",
            "registers_value_type_f32le": "Two registers, 32-bit, float, little-endian",
            "registers_value_type_u64be": "Four registers, 64-bit, integer, unsigned, big-endian",
            "registers_value_type_u64le": "Four registers, 64-bit, integer, unsigned, little-endian",
            "registers_value_type_s64be": "Four registers, 64-bit, integer, signed, big-endian",
            "registers_value_type_s64le": "Four registers, 64-bit, integer, signed, little-endian",
            "registers_value_type_f64be": "Four registers, 64-bit, float, big-endian",
            "registers_value_type_f64le": "Four registers, 64-bit, float, little-endian",
            "registers_offset": "Offset",
            "registers_scale_factor": "Scale factor",
            "registers_value_id": "Value"
        },
        "script": {
        }
    }
}
