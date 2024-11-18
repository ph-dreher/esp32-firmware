/* esp32-firmware
 * Copyright (C) 2021 Erik Fleckstein <erik@tinkerforge.com>
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

import * as util from "../../ts/util";
import * as API from "../../ts/api";
import { h, Fragment, RefObject } from "preact";
import { translate_unchecked, __ } from "../../ts/translation";
import { ConfigComponent } from "../../ts/components/config_component";
import { ConfigForm } from "../../ts/components/config_form";
import { FormRow } from "../../ts/components/form_row";
import { InputText } from "../../ts/components/input_text";
import { Collapse, ListGroup, ListGroupItem } from "react-bootstrap";
import { InputSelect } from "../../ts/components/input_select";
import { SubPage } from "../../ts/components/sub_page";
import { Table } from "../../ts/components/table";
import type { ChargeManagerStatus } from "./main"
import { InputFloat } from "../../ts/components/input_float";

type ChargeManagerConfig = API.getType["charge_manager/config"];
type ChargerConfig = ChargeManagerConfig["chargers"][0];
type ScanCharger = Exclude<API.getType['charge_manager/scan_result'], string>[0];

interface ChargersState {
    addCharger: ChargerConfig
    editCharger: ChargerConfig
    managementEnabled: boolean
    showExpert: boolean
    scanResult: Readonly<ScanCharger[]>
}

export function get_managed_chargers(): [string, string][] {
    if (!API.get("charge_manager/config").enable_charge_manager) {
        return [];
    }

    return API.get("charge_manager/config").chargers.map((charger, index) => [index.toString(), charger.name])
}


export class ChargeManagerChargers extends ConfigComponent<'charge_manager/config', {status_ref?: RefObject<ChargeManagerStatus>}, ChargersState> {
    intervalID: number = null;

    constructor() {
        super('charge_manager/config',
              __("charge_manager.script.save_failed"),
              __("charge_manager.script.reboot_content_changed"), {
                  addCharger: {host: "", name: "", rot: -1},
                  editCharger: {host: "", name: "", rot: -1},
                  managementEnabled: false,
                  showExpert: false,
                  scanResult: []
              });

        // Does not check if the event exists, in case the evse module is not compiled in.
        util.addApiEventListener_unchecked('evse/management_enabled', () => {
            let evse_enabled = API.get_unchecked('evse/management_enabled');
            if (evse_enabled != null) {
                this.setState({managementEnabled: evse_enabled.enabled});
            }
        });

        util.addApiEventListener('charge_manager/scan_result', () => {
            this.addScanResults(API.get('charge_manager/scan_result') as ScanCharger[]);
        });
    }

    addScanResults(result: ScanCharger[]) {
        // Copy to remove signals.
        let newResult: ScanCharger[] = result.filter(c => c).map(c => ({
            display_name: c.display_name,
            error: c.error,
            hostname: c.hostname,
            ip: c.ip,
        }));

        for (let oldC of this.state.scanResult) {
            let i = newResult.findIndex(c => c.hostname == oldC.hostname);
            if (i == -1)
                newResult.push(oldC);
            else if (newResult[i].ip == "[no_address]")
                newResult[i].ip = oldC.ip;
        }

        newResult.sort((a, b) => {
            if (a.error == 0 && b.error != 0)
                return -1;
            if (a.error != 0 && b.error == 0)
                return 1;
            return a.display_name.localeCompare(b.display_name);
        });

        this.setState({scanResult: newResult});
    }

    setCharger (i: number, val: Partial<ChargerConfig>){
        let chargers = this.state.chargers;
        chargers[i] = {...chargers[i], ...val};
        this.setState({chargers: chargers});
    }

    override async isSaveAllowed(cfg: ChargeManagerConfig): Promise<boolean> {
        for (let i = 0; i < cfg.chargers.length; i++)
            for (let a = i + 1; a < cfg.chargers.length; a++)
                if (cfg.chargers[a].host == cfg.chargers[i].host)
                    return false;
        return true;
    }

    override async sendSave(t: "charge_manager/config", cfg: ChargeManagerConfig) {
        const modal = util.async_modal_ref.current;
        let illegal_chargers = "";
        for (let i = 0; i < cfg.chargers.length; i++) {
            if (this.isMultiOrBroadcastIp(cfg.chargers[i].host))
                illegal_chargers += cfg.chargers[i].name + ": " + cfg.chargers[i].host + "<br>";
        }

        if (illegal_chargers != "" && !await modal.show({
            title: __("charge_manager.content.multi_broadcast_modal_title"),
            body: __("charge_manager.content.multi_broadcast_modal_body") + "<br><br>" + illegal_chargers + "<br>" + __("charge_manager.content.multi_broadcast_modal_body_end"),
            no_text: __("charge_manager.content.multi_broadcast_modal_cancel"),
            yes_text: __("charge_manager.content.multi_broadcast_modal_save"),
            no_variant: "secondary",
            yes_variant: "danger"
        }))
            return;

        if (API.hasModule("evse_common"))
            await API.save_unchecked('evse/management_enabled', {"enabled": this.state.managementEnabled}, translate_unchecked("charge_manager.script.save_failed"));

        let new_cfg: ChargeManagerConfig = {...API.get("charge_manager/config"),
            enable_charge_manager: cfg.enable_charge_manager,
            chargers: cfg.chargers,
            maximum_available_current: cfg.maximum_available_current};

        // Only set the default available current if it was equal to the old maximum (the user has probably not changed it)
        if ((API.get('charge_manager/config').default_available_current == API.get('charge_manager/config').maximum_available_current)
         || (new_cfg.maximum_available_current < API.get('charge_manager/config').default_available_current))
            new_cfg.default_available_current = new_cfg.maximum_available_current;

        await super.sendSave(t, new_cfg);
    }

    override async sendReset(t: "charge_manager/config"){
        const modal = util.async_modal_ref.current;
        if (!await modal.show({
            title:__("reset.reset_modal"),
                body: __("charge_manager.content.charge_manager_chargers_reset_modal_text"),
                no_text: __("reset.reset_modal_abort"),
                yes_text: __("reset.reset_modal_confirm"),
                no_variant: "secondary",
                yes_variant: "danger"
            }))
            return;

        if (API.hasModule("evse_common"))
            await API.save_unchecked('evse/management_enabled', {"enabled": false}, translate_unchecked("charge_manager.script.save_failed"));

        await super.sendReset(t);
    }

    override getIsModified(t: "charge_manager/config"): boolean {
        let evse_enabled = API.get_unchecked("evse/management_enabled");
        if (evse_enabled != null && evse_enabled.enabled)
            return true;
        return super.getIsModified(t);
    }

    insertLocalHost() {
        if (this.state.chargers.some(v => v.host == "127.0.0.1"))
            return;

        let name = API.get("info/display_name");
        let c = this.state.chargers;
        c.unshift({
            host: "127.0.0.1",
            name: name.display_name,
            rot: 0
        });
        this.setState({chargers: c})
    }

    async scan_services() {
        try {
            await API.call('charge_manager/scan', {}, __("charge_manager.script.scan_failed"))
        } catch {
            return;
        }
    }

    intToIP(int: number) {
        let part1 = int & 255;
        let part2 = ((int >> 8) & 255);
        let part3 = ((int >> 16) & 255);
        let part4 = ((int >> 24) & 255);

        return part4 + "." + part3 + "." + part2 + "." + part1;
    }

    isMultiOrBroadcastIp(v: string): boolean {
        const ip = util.parseIP(v);
        if (isNaN(ip))
            return false;

        const wifi_subnet = util.parseIP(API.get("wifi/sta_config").subnet);
        const wifi_ip = util.parseIP(API.get("wifi/sta_config").ip);
        const wifi_network = wifi_subnet & wifi_ip;
        const wifi_broadcast = (~wifi_subnet) | wifi_network;

        if (API.get("wifi/sta_config").subnet != "255.255.255.254" && (v == this.intToIP(wifi_broadcast) || v == this.intToIP(wifi_network)))
            return true;

        if (API.hasFeature("ethernet")) {
            const eth_subnet = util.parseIP(API.get_unchecked("ethernet/config").subnet);
            const eth_ip = util.parseIP(API.get_unchecked("ethernet/config").ip);
            const eth_network = eth_ip & eth_subnet;
            const eth_broadcast = (~eth_subnet) | eth_network;
            if (API.get_unchecked("ethernet/config")?.subnet != "255.255.255.254" && (v == this.intToIP(eth_broadcast) || v == this.intToIP(eth_network)))
                return true;
        }

        const start_multicast = util.parseIP("224.0.0.0");
        const end_multicast = util.parseIP("239.255.255.255");
        if (ip >= start_multicast && ip <= end_multicast)
            return true;

        const ap_ip = util.parseIP(API.get("wifi/ap_config").ip);
        const ap_subnet = util.parseIP(API.get("wifi/ap_config").subnet);
        const ap_network = ap_ip & ap_subnet;
        const ap_broadcast =  (~ap_subnet) | ap_network;
        if (API.get("wifi/ap_config").subnet != "255.255.255.254" && (v == this.intToIP(ap_network) || v == this.intToIP(ap_broadcast)))
            return true;
    }

    render(props: {}, state: ChargeManagerConfig & ChargersState) {
        if (!util.render_allowed())
            return <SubPage name="charge_manager_chargers" />;

        const MAX_CONTROLLED_CHARGERS = API.hasModule("esp32_ethernet_brick") ? 64 : 10;

        let energyManagerMode = API.hasModule("em_common") && !(API.hasModule("evse_v2") || API.hasModule("evse"));

        const check_host = (host: string, idx: number): string => {
            let ret: string;

            if (!energyManagerMode && idx != 0 && (host.toLowerCase() == 'localhost' || host == '127.0.0.1')) {
                return __("charge_manager.content.host_exists");
            }

            state.chargers.forEach((charger, i) => {
                if (charger.host.toLowerCase() == host.toLowerCase() && idx != i) {
                    ret = __("charge_manager.content.host_exists");
                    return;
                }
            });

            return ret;
        }

        let charge_manager_mode = <FormRow label={__("charge_manager.content.enable_charge_manager")} label_muted={__("charge_manager.content.enable_charge_manager_muted")}>
             <InputSelect
                    items={[
                        ["0",__("charge_manager.content.mode_disabled")],
                        ["1",__("charge_manager.content.mode_managed")],
                        ["2",__("charge_manager.content.mode_manager")],
                    ]}
                    value={state.enable_charge_manager ? "2" : state.managementEnabled ? "1" : "0"}
                    onValue={(v) => {
                        if (v == "2") {
                            this.insertLocalHost();
                        }
                        this.setState({enable_charge_manager: v == "2", managementEnabled: v != "0"})
                    }}
                />
                <div class="pt-3 pb-4">
                    {translate_unchecked(`charge_manager.script.mode_explainer_${state.enable_charge_manager ? "2" : state.managementEnabled ? "1" : "0"}`)}
                </div>
            </FormRow>;

        let chargers = <FormRow label={__("charge_manager.content.managed_boxes")}>
                    <Table
                        columnNames={[__("charge_manager.content.table_charger_name"), __("charge_manager.content.table_charger_host"), __("charge_manager.content.table_charger_rotation")]}
                        rows={state.chargers.map((charger, i) =>
                            { return {
                                columnValues: [
                                    charger.name,
                                    util.remoteAccessMode ? charger.host : <a target="_blank" rel="noopener noreferrer" href={(charger.host == '127.0.0.1' || charger.host == 'localhost') ? '/' : "http://" + charger.host}>{charger.host}</a>,
                                    translate_unchecked(`charge_manager.content.rotation_${charger.rot}`)
                                ],
                                editTitle: __("charge_manager.content.edit_charger_title"),
                                onEditShow: async () => this.setState({editCharger: charger}),
                                onEditGetChildren: () => [<>
                                    <FormRow label={__("charge_manager.content.edit_charger_name")}>
                                        <InputText value={state.editCharger.name}
                                            onValue={(v) => this.setState({editCharger: {...state.editCharger, name: v}})}
                                            maxLength={32}
                                            required
                                        />
                                    </FormRow>
                                    <FormRow label={__("charge_manager.content.edit_charger_host")}>
                                        <InputText value={state.editCharger.host}
                                            onValue={(v) => this.setState({editCharger: {...state.editCharger, host: v}})}
                                            maxLength={64}
                                            pattern="^[a-zA-Z0-9\-\.]+$"
                                            required
                                            disabled={!energyManagerMode && (charger.host == '127.0.0.1' || charger.host == 'localhost')}
                                            class={check_host(state.editCharger.host, i) != undefined ? "is-invalid" : ""}
                                            invalidFeedback={check_host(state.editCharger.host, i)}/>
                                    </FormRow>
                                    <FormRow label={__("charge_manager.content.edit_charger_rotation")} help={__("charge_manager.content.charger_rotation_help")}>
                                        <InputSelect items={[
                                                ["0", __("charge_manager.content.rotation_0")],
                                                ["right-disabled", __("charge_manager.content.rotation_right")],
                                                ["1", __("charge_manager.content.rotation_1")],
                                                ["3", __("charge_manager.content.rotation_3")],
                                                ["6", __("charge_manager.content.rotation_6")],
                                                ["left-disabled", __("charge_manager.content.rotation_left")],
                                                ["2", __("charge_manager.content.rotation_2")],
                                                ["4", __("charge_manager.content.rotation_4")],
                                                ["5", __("charge_manager.content.rotation_5")],
                                            ]}
                                            value={state.editCharger.rot}
                                            onValue={(v) => this.setState({editCharger: {...state.editCharger, rot: parseInt(v)}})}
                                            placeholder={__("charge_manager.content.add_charger_rotation_select")}
                                            required
                                            />
                                    </FormRow>
                                </>],
                                onEditSubmit: async () => {
                                    this.setState({chargers: state.chargers.map((charger, k) => i === k ? state.editCharger : charger)});
                                    this.setDirty(true);
                                },
                                onRemoveClick: !energyManagerMode && (charger.host == '127.0.0.1' || charger.host == 'localhost') ? undefined : async () => {
                                    this.setState({chargers: state.chargers.filter((v, idx) => idx != i)});
                                    this.setDirty(true);
                                }
                            }})
                        }
                        addEnabled={state.chargers.length < MAX_CONTROLLED_CHARGERS}
                        addTitle={__("charge_manager.content.add_charger_title")}
                        addMessage={__("charge_manager.content.add_charger_count")(state.chargers.length, MAX_CONTROLLED_CHARGERS)}
                        onAddShow={async () => {
                            this.setState({addCharger: {name: "", host: "", rot: -1}});
                            this.scan_services();
                            this.intervalID = window.setInterval(this.scan_services, 3000);
                        }}
                        onAddGetChildren={() => [<>
                            <FormRow label={__("charge_manager.content.add_charger_name")}>
                                <InputText value={state.addCharger.name}
                                    onValue={(v) => this.setState({addCharger: {...state.addCharger, name: v}})}
                                    maxLength={32}
                                    required
                                />
                            </FormRow>
                            <FormRow label={__("charge_manager.content.add_charger_host")}>
                                <InputText value={state.addCharger.host}
                                    onValue={(v) => this.setState({addCharger: {...state.addCharger, host: v}})}
                                    maxLength={64}
                                    pattern="^[a-zA-Z0-9\-\.]+$"
                                    required
                                    class={check_host(state.addCharger.host, -1) != undefined ? "is-invalid" : ""}
                                    invalidFeedback={check_host(state.addCharger.host, -1)}/>
                            </FormRow>
                            <FormRow label={__("charge_manager.content.add_charger_found")}>
                                <ListGroup>{
                                    state.scanResult.filter(c => !state.chargers.some(c1 => c1.host == c.hostname + ".local" || c1.host == c.ip))
                                        .map(c => (
                                            <ListGroupItem key={c.hostname}
                                                        action type="button"
                                                        onClick={c.error != 0 ? undefined : () => {
                                                            this.setState({addCharger: {host: c.hostname + ".local", name: c.display_name, rot: 0}})
                                                        }}
                                                        style={c.error == 0 ? "" : "cursor: default; background-color: #eeeeee !important;"}>
                                                <div class="d-flex w-100 justify-content-between">
                                                    <span class="h5 text-left">{c.display_name}</span>
                                                    {c.error == 0 ? null :
                                                        <span class="text-right" style="color:red">{translate_unchecked(`charge_manager.content.scan_error_${c.error}`)}</span>
                                                    }
                                                </div>
                                                <div class="d-flex w-100 justify-content-between">
                                                    {util.remoteAccessMode ? <span>{c.hostname + ".local"}</span> : <a target="_blank" rel="noopener noreferrer" href={"http://" + c.hostname + ".local"}>{c.hostname + ".local"}</a>}
                                                    {util.remoteAccessMode ? <span>{c.ip}</span> : <a target="_blank" rel="noopener noreferrer" href={"http://" + c.ip}>{c.ip}</a>}
                                                </div>
                                            </ListGroupItem>))
                                }</ListGroup>
                            </FormRow>
                            <FormRow label={__("charge_manager.content.add_charger_rotation")} help={__("charge_manager.content.charger_rotation_help")}>
                                    <InputSelect items={[
                                            ["0", __("charge_manager.content.rotation_0")],
                                            ["right-disabled", __("charge_manager.content.rotation_right")],
                                            ["1", __("charge_manager.content.rotation_1")],
                                            ["3", __("charge_manager.content.rotation_3")],
                                            ["6", __("charge_manager.content.rotation_6")],
                                            ["left-disabled", __("charge_manager.content.rotation_left")],
                                            ["2", __("charge_manager.content.rotation_2")],
                                            ["4", __("charge_manager.content.rotation_4")],
                                            ["5", __("charge_manager.content.rotation_5")],
                                        ]}
                                        value={state.addCharger.rot}
                                        onValue={(v) => this.setState({addCharger: {...state.addCharger, rot: parseInt(v)}})}
                                        placeholder={__("charge_manager.content.add_charger_rotation_select")}
                                        required
                                        />
                                </FormRow>
                        </>]}
                        onAddSubmit={async () => {
                            this.setState({chargers: state.chargers.concat(state.addCharger)});
                            this.setDirty(true);
                        }}
                        onAddHide={async () => {
                            window.clearInterval(this.intervalID);
                        }} />
            </FormRow>

        let available_current = <FormRow label={__("charge_manager.content.maximum_available_current")} label_muted={__("charge_manager.content.maximum_available_current_muted")}>
            <InputFloat
                unit="A"
                value={state.maximum_available_current}
                onValue={(v) => {
                    this.setState({maximum_available_current: v});
                }}
                digits={3}
                min={state.enable_charge_manager ? 6000 : 0}
                max={1000000}
                />
            </FormRow>

        return (
            <SubPage name="charge_manager_chargers">
                <ConfigForm id="chargers_config_form" title={__("charge_manager.content.charge_manager_chargers")} isModified={this.isModified()} isDirty={this.isDirty()} onSave={this.save} onReset={this.reset} onDirtyChange={this.setDirty}>
                    {energyManagerMode ?
                        <>
                            {available_current}
                            {chargers}
                        </>
                        : <>
                            {charge_manager_mode}

                            <Collapse in={state.enable_charge_manager}>
                                <div>
                                    {available_current}
                                    {chargers}
                                </div>
                            </Collapse>
                        </>
                    }
                </ConfigForm>
            </SubPage>
        )
    }
}
