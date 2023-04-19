//APIPath:evse/

interface Slot {
    max_current: number,
    active: boolean,
    clear_on_disconnect: boolean
}

export const EVSE_SLOT_INCOMING_CABLE = 0;
export const EVSE_SLOT_OUTGOING_CABLE = 1;
export const EVSE_SLOT_SHUTDOWN_INPUT = 2;
export const EVSE_SLOT_GP_INPUT = 3;
export const EVSE_SLOT_AUTOSTART_BUTTON = 4;
export const EVSE_SLOT_GLOBAL = 5;
export const EVSE_SLOT_USER = 6;
export const EVSE_SLOT_CHARGE_MANAGER = 7;
export const EVSE_SLOT_EXTERNAL = 8;
export const EVSE_SLOT_MODBUS_TCP = 9;
export const EVSE_SLOT_MODBUS_TCP_ENABLE = 10;
export const EVSE_SLOT_OCPP = 11;

export type slots = Slot[];

export interface button_state {
    button_press_time: number,
    button_release_time: number,
    button_pressed: boolean
}

export interface indicator_led {
    indication: number,
    duration: number
}

export interface low_level_state {
    led_state: number,
    cp_pwm_duty_cycle: number,
    adc_values: number[],
    voltages: number[],
    resistances: number[],
    gpio: boolean[],
    charging_time: number,
    time_since_state_change: number,
    uptime: number,
}

export interface external_current {
    current: number
}

export interface external_clear_on_disconnect {
    clear_on_disconnect: boolean
}

export interface management_current {
    current: number
}

export interface auto_start_charging {
    auto_start_charging: boolean
}

export interface global_current {
    current: number
}

export interface management_enabled {
    enabled: boolean;
}

export interface user_enabled {
    enabled: boolean;
}

export interface external_enabled {
    enabled: boolean;
}

export interface external_defaults {
    current: number,
    clear_on_disconnect: boolean
}

export interface start_charging {

}

export interface stop_charging {

}

export type debug_header = string;
export type debug = string;

export interface reflash {

}

export interface reset {

}

export interface boost_mode {
    enabled: boolean
}

export interface require_meter_enabled {
    enabled: boolean
}
