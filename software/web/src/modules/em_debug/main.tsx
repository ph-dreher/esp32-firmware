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

import * as API from "../../ts/api";
import * as util from "../../ts/util";
import { __ } from "../../ts/translation";
import { h, Fragment, Component } from "preact";
import { DebugLogger    } from "../../ts/components/debug_logger";
import { FormRow        } from "../../ts/components/form_row";
import { FormSeparator  } from "../../ts/components/form_separator";
import { IndicatorGroup } from "../../ts/components/indicator_group";
import { InputText      } from "../../ts/components/input_text";
import { OutputFloat    } from "../../ts/components/output_float";
import { PageHeader     } from "../../ts/components/page_header";
import { Button } from "react-bootstrap";
import { SubPage } from "../../ts/components/sub_page";
import { NavbarItem } from "../../ts/components/navbar_item";
import { Terminal } from "react-feather";

export function EMDebugNavbar() {
    return <NavbarItem name="em_debug" module="em_v1" title={__("em_debug.navbar.em_debug")} symbol={<Terminal />} />;
}

export class EMDebug extends Component {
    ms2time(ms: number) {
        let s = ms / 1000;
        let m = Math.trunc(s / 60);
        s = Math.trunc(s % 60);

        return m.toString() + "m " + s.toString() + "s";
    }

    render() {
        if (!util.render_allowed() || !API.hasFeature("energy_manager"))
            return <SubPage name="em_debug" />;

        let ll_state    = API.get('energy_manager/low_level_state');
        let state       = API.get('energy_manager/state');
        let pm_ll_state = API.get('power_manager/low_level_state');

        return (
            <SubPage name="em_debug">
                <PageHeader title={__("em_debug.content.em_debug")}/>
                <FormRow label={__("em_debug.content.reset_description")} label_muted={__("em_debug.content.reset_description_muted")}>
                    <div class="input-group pb-2">
                        <Button variant="primary" className="form-control rounded-right mr-2" onClick={() => API.call('energy_manager/reset', {}, "")}>{__("em_debug.content.reset_em")}</Button>
                        <Button variant="primary" className="form-control rounded-left" onClick={() => API.call('energy_manager/reflash', {}, "")}>{__("em_debug.content.reflash_em")}</Button>
                    </div>
                </FormRow>

                <FormSeparator heading={__("em_debug.content.protocol")} first={true} />
                <DebugLogger translationPrefix="em_debug" />

                <FormSeparator heading={__("em_debug.content.internal_state")} />
                <FormRow label="power at meter smooth">
                    <OutputFloat value={pm_ll_state.power_at_meter} digits={3} scale={3} unit={'kW'} />
                </FormRow>
                <FormRow label="power available">
                    <OutputFloat value={pm_ll_state.power_available} digits={3} scale={3} unit={'kW'} />
                </FormRow>
                <FormRow label="overall min power">
                    <OutputFloat value={pm_ll_state.overall_min_power} digits={3} scale={3} unit={'kW'} />
                </FormRow>
                <FormRow label="max current limited">
                    <OutputFloat value={pm_ll_state.max_current_limited} digits={3} scale={3} unit={'A'} />
                </FormRow>
                <FormRow label="is 3phase">
                    <IndicatorGroup
                        value={pm_ll_state.is_3phase ? 1 : 0}
                        items={[
                            ["secondary", "false"],
                            ["primary",   "true" ],
                        ]} />
                </FormRow>
                <FormRow label="charging blocked">
                    <InputText value={"0x" + pm_ll_state.charging_blocked.toString(16)}/>
                </FormRow>
                <FormRow label="consecutive bricklet errors">
                    <InputText value={ll_state.consecutive_bricklet_errors}/>
                </FormRow>

                <FormSeparator heading={__("em_debug.content.hardware_state")} />
                <FormRow label={__("em_debug.content.contactor_control")}>
                    <IndicatorGroup
                        value={ll_state.contactor ? 1 : 0}
                        items={[
                            ["secondary", __("em_debug.content.contactor_off")],
                            ["primary", __("em_debug.content.contactor_on")],
                        ]} />
                </FormRow>

                <FormRow label={__("em_debug.content.contactor_check")}>
                    <IndicatorGroup
                        value={ll_state.contactor_check_state ? 0 : 1} // intentionally inverted, OK is first
                        items={[
                            ["success", __("em_debug.content.contactor_check_ok")],
                            ["danger", __("em_debug.content.contactor_check_fail")],
                        ]} />
                </FormRow>

                <FormRow label={__("em_debug.content.state_led")} label_muted={__("em_debug.content.state_led_names")}>
                    <div class="row mx-n1">
                        {ll_state.led_rgb.map((x, i) => (
                            <div key={i} class="mb-1 col-4 px-1">
                                <InputText value={x} />
                            </div>
                        ))}
                    </div>
                </FormRow>

                <FormRow label={__("em_debug.content.gpios")} label_muted={__("em_debug.content.gpio_names_0")}>
                    <div class="row mx-n1">
                        {[state.input3_state, state.input4_state, state.relay_state].map((x, j) => (
                            <IndicatorGroup vertical key={j} class="mb-1 col px-1"
                                value={x ? 0 : 1} //intentionally inverted: the high button is the first
                                items={[
                                    ["primary", __("em_debug.content.high")],
                                    ["secondary", __("em_debug.content.low")]
                                ]} />
                        ))}
                    </div>
                </FormRow>

                <FormRow label={__("em_debug.content.state_input_voltage")}>
                    <OutputFloat value={ll_state.input_voltage} digits={3} scale={3} unit={'V'} />
                </FormRow>
            </SubPage>
        );
    }
}

export function init() {
}
