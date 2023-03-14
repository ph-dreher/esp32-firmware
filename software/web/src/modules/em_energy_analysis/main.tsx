/* esp32-firmware
 * Copyright (C) 2022 Olaf Lüke <olaf@tinkerforge.com>
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

import $ from "../../ts/jq";

import * as API from "../../ts/api";
import * as util from "../../ts/util";

import { h, render, createRef, Fragment, Component, ComponentChild, RefObject } from "preact";
import { __ } from "../../ts/translation";
import { PageHeader } from "../../ts/components/page_header";
import { InputDate } from "../../ts/components/input_date";
import { FormRow } from "../../ts/components/form_row";
import uPlot from 'uplot';

interface UplotData {
    timestamp: number;
    names: string[];
    values: number[][];
}

interface Wallbox5minData {
    timestamp: number;
    empty: boolean;
    flags: number[]; // bit 0-2 = charger state, bit 7 = no data
    power: number[];
};

interface WallboxDailyData {
    energy: number[]; // kWh
};

interface EnergyManager5minData {
    timestamp: number;
    empty: boolean;
    flags: number[]; // bit 0 = 1p/3p, bit 1-2 = input, bit 3 = output, bit 7 = no data
    power_grid: number[]; // W
    power_general: number[][]; // W
};

interface EnergyManagerDailyData {
    energy_grid_in: number[]; // kWh
    energy_grid_out: number[]; // kWh
    energy_general_in: number[][]; // kWh
    energy_general_out: number[][]; // kWh
};

interface UplotWrapperProps {
    id: string;
    class: string;
    sidebar_id: string;
    y_min: number;
    y_max: number;
}

// https://seaborn.pydata.org/tutorial/color_palettes.html#qualitative-color-palettes
// sns.color_palette("tab10")
const colors = [
    '#1f77b4',
    '#ff7f0e',
    '#2ca02c',
    '#d62728',
    '#9467bd',
    '#8c564b',
    '#e377c2',
    '#7f7f7f',
    '#bcbd22',
    '#17becf',
];

class UplotWrapper extends Component<UplotWrapperProps, {}> {
    uplot: uPlot;
    series_count: number = 1;
    pending_data: UplotData;
    visible: boolean = false;
    div_ref = createRef();
    no_data_ref = createRef();
    loading_ref = createRef();
    observer: ResizeObserver;

    shouldComponentUpdate() {
        return false;
    }

    componentDidMount() {
        if (this.uplot) {
            return;
        }

        // FIXME: special hack for status page that is visible by default
        //        and doesn't receive an initial shown event because of that
        this.visible = this.props.sidebar_id === "status";

        // We have to use jquery here or else the events don't fire?
        // This can be removed once the sidebar is ported to preact.
        $(`#sidebar-${this.props.sidebar_id}`).on('shown.bs.tab', () => {
            this.visible = true;

            if (this.pending_data !== undefined) {
                this.set_data(this.pending_data);
            }
        });

        $(`#sidebar-${this.props.sidebar_id}`).on('hidden.bs.tab', () => {
            this.visible = false;
        });

        let get_size = () => {
            let div = this.div_ref.current;
            let aspect_ratio = parseFloat(getComputedStyle(div).aspectRatio);

            return {
                width: div.clientWidth,
                height: Math.floor(div.clientWidth / aspect_ratio),
            }
        }

        let options = {
            ...get_size(),
            pxAlign: 0,
            cursor: {
                drag: {
                    x: false, // disable zoom
                },
            },
            series: [
                {
                    label: __("em_energy_analysis.script.time"),
                    value: __("em_energy_analysis.script.time_legend_format"),
                },
            ],
            axes: [
                {
                    size: 35,
                    incrs: [
                        60,
                        60 * 2,
                        3600,
                        3600 * 2,
                        3600 * 4,
                        3600 * 6,
                        3600 * 8,
                        3600 * 12,
                        3600 * 24,
                    ],
                    // [0]:   minimum num secs in found axis split (tick incr)
                    // [1]:   default tick format
                    // [2-7]: rollover tick formats
                    // [8]:   mode: 0: replace [1] -> [2-7], 1: concat [1] + [2-7]
                    values: [
                        // tick incr  default      year  month  day   hour  min   sec   mode
                        [60,          "{HH}:{mm}", null, null,  null, null, null, null, 1],
                    ],
                },
                {
                    size: 55,
                }
            ],
            scales: {
                y: {
                    range: {
                        max: {
                            soft: this.props.y_max,
                            mode: (this.props.y_max !== undefined ? 1 : 3) as uPlot.Range.SoftMode,
                        },
                        min: {
                            soft: this.props.y_min,
                            mode: (this.props.y_min !== undefined ? 1 : 3) as uPlot.Range.SoftMode,
                        },
                    },
                },
            },
        };

        let div = this.div_ref.current;
        this.uplot = new uPlot(options, [], div);

        let resize = () => {
            let size = get_size();

            if (size.width == 0 || size.height == 0) {
                return;
            }

            this.uplot.setSize(size);
        };

        try {
            this.observer = new ResizeObserver(() => {
                resize();
            });

            this.observer.observe(div);
        } catch (e) {
            setInterval(() => {
                resize();
            }, 500);

            window.addEventListener("resize", e => {
                resize();
            });
        }
    }

    render(props?: UplotWrapperProps, state?: Readonly<{}>, context?: any): ComponentChild {
        return (
            <div>
                <div ref={this.no_data_ref} style="position: absolute; width: calc(100% - 30px); top: 47%; visibility: hidden; text-align: center;">
                    <span class="h3">{__("em_energy_analysis.content.no_data")}</span>
                </div>
                <div ref={this.loading_ref} style="position: absolute; width: calc(100% - 30px); top: 47%; visibility: hidden; text-align: center;">
                    <span class="h3">{__("em_energy_analysis.content.loading")}</span>
                </div>
                <div ref={this.div_ref} id={props.id} class={props.class} />
            </div>
        );
    }

    set_loading() {
        this.div_ref.current.style.visibility = 'hidden';
        this.no_data_ref.current.style.visibility = 'hidden';
        this.loading_ref.current.style.visibility = 'visible';
    }

    set_data(data: UplotData) {
        if (!this.uplot || !this.visible) {
            this.pending_data = data;
            return;
        }

        this.pending_data = undefined;
        this.loading_ref.current.style.visibility = 'hidden';

        if (!data || data.names.length <= 1) {
            this.div_ref.current.style.visibility = 'hidden';
            this.no_data_ref.current.style.visibility = 'visible';
        }
        else {
            this.div_ref.current.style.visibility = 'visible';
            this.no_data_ref.current.style.visibility = 'hidden';

            while (this.series_count > 1) {
                --this.series_count;

                this.uplot.delSeries(this.series_count);
            }

            while (this.series_count < data.names.length) {
                let name = data.names[this.series_count];

                this.uplot.addSeries({
                    show: true,
                    pxAlign: 0,
                    spanGaps: false,
                    label: __("em_energy_analysis.script.power") + (name ? ' ' + name: ''), // FIXME
                    value: (self: uPlot, rawValue: number) => rawValue !== null ? rawValue + " W" : null,
                    stroke: colors[(this.series_count - 1) % colors.length],
                    width: 2,
                });

                ++this.series_count;
            }

            this.uplot.setData(data.values as any);
        }
    }
}

export class EMEnergyAnalysisStatusChart extends Component<{}, {}> {
    uplot_wrapper_ref = createRef();

    render(props: {}, state: {}) {
        return (
            <>
                <UplotWrapper ref={this.uplot_wrapper_ref} id="em_energy_analysis_status_chart" class="em-energy-analysis-status-chart" sidebar_id="status" y_min={0} y_max={1500} />
            </>
        )
    }
}

interface EMEnergyAnalysisProps {
    status_ref: RefObject<EMEnergyAnalysisStatusChart>;
}

interface EMEnergyAnalysisState {
    current_5min_date: Date;
}

interface Charger {
    uid: number;
    name: string;
}

export class EMEnergyAnalysis extends Component<EMEnergyAnalysisProps, EMEnergyAnalysisState> {
    uplot_wrapper_ref = createRef();
    status_ref: RefObject<EMEnergyAnalysisStatusChart> = null;
    uplot_update_timeout: number = null;
    uplot_5min_cache: { [id: string]: UplotData } = {};
    uplot_5min_status_cache: { [id: string]: UplotData } = {};
    uplot_daily_cache: { [id: string]: UplotData } = {};
    wallbox_5min_cache: { [id: number]: { [id: string]: Wallbox5minData } } = {};
    wallbox_daily_cache: { [id: string]: WallboxDailyData } = {};
    energy_manager_5min_cache: { [id: string]: EnergyManager5minData } = {};
    energy_manager_daily_cache: { [id: string]: EnergyManagerDailyData } = {};
    chargers: Charger[] = [];

    constructor(props: EMEnergyAnalysisProps) {
        super(props);

        this.status_ref = props.status_ref;

        let current_5min_date: Date = new Date();

        current_5min_date.setHours(0);
        current_5min_date.setMinutes(0);
        current_5min_date.setSeconds(0);
        current_5min_date.setMilliseconds(0);

        this.state = {
            current_5min_date: current_5min_date
        } as any;

        util.eventTarget.addEventListener('charge_manager/state', () => {
            let state = API.get('charge_manager/state');
            let chargers: Charger[] = [];

            for (let charger of state.chargers) {
                if (charger.uid > 0) {
                    chargers.push({uid: charger.uid, name: charger.name});
                }
            }

            if (this.chargers.length != chargers.length) {
                this.chargers = chargers;
                this.reload_wallbox_cache();
            }
            else {
                for (let i = 0; i < this.chargers.length; ++i) {
                    if (this.chargers[i].uid != chargers[i].uid || this.chargers[i].name != chargers[i].name) {
                        this.chargers = chargers;
                        this.reload_wallbox_cache();
                        break;
                    }
                }
            }
        });

        util.eventTarget.addEventListener('energy_manager/history_wallbox_5min_changed', () => {
            let changed = API.get('energy_manager/history_wallbox_5min_changed');
            let subcache = this.wallbox_5min_cache[changed.uid];

            if (!subcache) {
                // got changed event without having this UID cached before
                this.update_wallbox_5min_cache(changed.uid, new Date(changed.year, changed.month - 1, changed.day))
                    .then((success: boolean) => {
                        if (success) {
                            this.schedule_uplot_update();
                        }
                    });
            } else {
                let key = `${changed.year}-${changed.month}-${changed.day}`;
                let data = subcache[key];

                if (!data) {
                    // got changed event without having this day cached before
                    this.update_wallbox_5min_cache(changed.uid, new Date(changed.year, changed.month - 1, changed.day))
                        .then((success: boolean) => {
                            if (success) {
                                this.schedule_uplot_update();
                            }
                        });
                }
                else {
                    let slot = Math.floor((changed.hour * 60 + changed.minute) / 5);

                    data.timestamp = Date.now();
                    data.flags[slot] = changed.flags;
                    data.power[slot] = changed.power;

                    if ((changed.flags & 0x80 /* no data */) == 0) {
                        data.empty = false;
                    }
                }

                this.schedule_uplot_update();
            }
        });

        util.eventTarget.addEventListener('energy_manager/history_energy_manager_5min_changed', () => {
            let changed = API.get('energy_manager/history_energy_manager_5min_changed');
            let key = `${changed.year}-${changed.month}-${changed.day}`;
            let data = this.energy_manager_5min_cache[key];

            if (!data) {
                // got changed event without having this day cached before
                this.update_energy_manager_5min_cache(new Date(changed.year, changed.month - 1, changed.day))
                    .then((success: boolean) => {
                        if (success) {
                            this.schedule_uplot_update();
                        }
                    });
            } else {
                let slot = Math.floor((changed.hour * 60 + changed.minute) / 5);

                data.timestamp = Date.now();
                data.flags[slot] = changed.flags;
                data.power_grid[slot] = changed.power_grid;
                data.power_general[slot] = changed.power_general;

                if ((changed.flags & 0x80 /* no data */) == 0) {
                    data.empty = false;
                }

                this.schedule_uplot_update();
            }
        });
    }

    componentDidMount() {
        this.update_current_5min_cache();

        // FIXME: update all caches
    }

    date_to_5min_key(date: Date) {
        let year: number = date.getFullYear();
        let month: number = date.getMonth() + 1;
        let day: number = date.getDate();

        return`${year}-${month}-${day}`;
    }

    update_uplot_5min_cache(date: Date) {
        let key = this.date_to_5min_key(date);
        let uplot_data = this.uplot_5min_cache[key];
        let needs_update = false;

        if (!uplot_data) {
            needs_update = true;
        }
        else {
            let energy_manager_data = this.energy_manager_5min_cache[key];

            if (energy_manager_data && uplot_data.timestamp < energy_manager_data.timestamp) {
                needs_update = true;
            }

            if (!needs_update) {
                for (let charger of this.chargers) {
                    if (this.wallbox_5min_cache[charger.uid]) {
                        let wallbox_data = this.wallbox_5min_cache[charger.uid][key];

                        if (wallbox_data && uplot_data.timestamp < wallbox_data.timestamp) {
                            needs_update = true;
                            break;
                        }
                    }
                }
            }
        }

        if (!needs_update) {
            return;
        }

        let slot_count = 288;
        let timestamps: number[] = new Array(slot_count);
        let base = date.getTime() / 1000;

        for (let slot = 0; slot < slot_count; ++slot) {
            timestamps[slot] = base + slot * 300;
        }

        uplot_data = {timestamp: Date.now(), names: [null], values: [timestamps]};

        let energy_manager_data = this.energy_manager_5min_cache[key];

        if (energy_manager_data && !energy_manager_data.empty) {
            uplot_data.names.push(__("em_energy_analysis.script.grid_connection"));
            uplot_data.values.push(energy_manager_data.power_grid);
        }

        for (let charger of this.chargers) {
            if (this.wallbox_5min_cache[charger.uid]) {
                let wallbox_data = this.wallbox_5min_cache[charger.uid][key];

                if (wallbox_data && !wallbox_data.empty) {
                    uplot_data.names.push(charger.name);
                    uplot_data.values.push(wallbox_data.power);
                }
            }
        }

        this.uplot_5min_cache[key] = uplot_data;
    }

    update_uplot_5min_status_cache(date: Date) {
        let key = this.date_to_5min_key(date);
        let uplot_data = this.uplot_5min_status_cache[key];
        let needs_update = false;

        if (!uplot_data) {
            needs_update = true;
        }
        else {
            let energy_manager_data = this.energy_manager_5min_cache[key];

            if (energy_manager_data && uplot_data.timestamp < energy_manager_data.timestamp) {
                needs_update = true;
            }
        }

        if (!needs_update) {
            return;
        }

        let slot_count = 288;
        let timestamps: number[] = new Array(slot_count);
        let base = date.getTime() / 1000;

        for (let slot = 0; slot < slot_count; ++slot) {
            timestamps[slot] = base + slot * 300;
        }

        uplot_data = {timestamp: Date.now(), names: [null], values: [timestamps]};

        let energy_manager_data = this.energy_manager_5min_cache[key];

        if (energy_manager_data && !energy_manager_data.empty) {
            uplot_data.names.push(null);
            uplot_data.values.push(energy_manager_data.power_grid);
        }

        this.uplot_5min_status_cache[key] = uplot_data;
    }

    async update_wallbox_5min_cache_all(date: Date) {
        let all: Promise<boolean>[] = [];

        for (let charger of this.chargers) {
            all.push(this.update_wallbox_5min_cache(charger.uid, date));
        }

        let result = await Promise<boolean[]>.all(all);

        for (let success of result) {
            if (!success) {
                return false;
            }
        }

        return true;
    }

    async update_wallbox_5min_cache(uid: number, date: Date) {
        let now = Date.now();

        if (date.getTime() > now) {
            return true;
        }

        let key = this.date_to_5min_key(date);

        if (this.wallbox_5min_cache[uid] && this.wallbox_5min_cache[uid][key]) {
            // cache is valid
            return true;
        }

        let year: number = date.getFullYear();
        let month: number = date.getMonth() + 1;
        let day: number = date.getDate();
        let slot_count = 288;
        let data: Wallbox5minData = {timestamp: now, empty: true, flags: new Array(slot_count), power: new Array(slot_count)};
        let response: string = '';

        try {
            response = await (await util.put('energy_manager/history_wallbox_5min', {uid: uid, year: year, month: month, day: day})).text();
        } catch (e) {
            console.log('Could not get wallbox 5min data: ' + e);
            return false;
        }

        let payload = JSON.parse(response);

        for (let slot = 0; slot < slot_count; ++slot) {
            data.flags[slot] = payload[slot * 2];
            data.power[slot] = payload[slot * 2 + 1];

            if ((data.flags[slot] & 0x80 /* no data */) == 0) {
                data.empty = false;
            }
        }

        if (!this.wallbox_5min_cache[uid]) {
            this.wallbox_5min_cache[uid] = {};
        }

        this.wallbox_5min_cache[uid][key] = data;

        return true;
    }

    async update_energy_manager_5min_cache(date: Date) {
        let now = Date.now();

        if (date.getTime() > now) {
            return true;
        }

        let key = this.date_to_5min_key(date);

        if (this.energy_manager_5min_cache[key]) {
            // cache is valid
            return true;
        }

        let year: number = date.getFullYear();
        let month: number = date.getMonth() + 1;
        let day: number = date.getDate();
        let slot_count = 288;
        let data: EnergyManager5minData = {timestamp: now, empty: true, flags: new Array(slot_count), power_grid: new Array(slot_count), power_general: new Array(slot_count)};
        let response: string = '';

        try {
            response = await (await util.put('energy_manager/history_energy_manager_5min', {year: year, month: month, day: day})).text();
        } catch (e) {
            console.log('Could not get energy manager 5min data: ' + e);
            return false;
        }

        let payload = JSON.parse(response);

        for (let slot = 0; slot < 288; ++slot) {
            data.flags[slot] = payload[slot * 8];
            data.power_grid[slot] = payload[slot * 8 + 1];
            data.power_general[slot] = [
                payload[slot * 8 + 2],
                payload[slot * 8 + 3],
                payload[slot * 8 + 4],
                payload[slot * 8 + 5],
                payload[slot * 8 + 6],
                payload[slot * 8 + 7],
            ];

            if ((data.flags[slot] & 0x80 /* no data */) == 0) {
                data.empty = false;
            }
        }

        this.energy_manager_5min_cache[key] = data;

        return true;
    }

    /*async update_wallbox_daily_cache() {
        for (let charger of this.chargers) {
            let year: number = 2023;
            let month: number = 2;
            let id = `${charger.uid}-${year}-${month}`;
            let response: string = '';

            try {
                response = await (await util.put('energy_manager/history_wallbox_daily', {uid: charger.uid, year: year, month: month})).text();
            } catch (e) {
                console.log('Could not get wallbox daily data: ' + e);
            }

            if (response) {
                let payload = JSON.parse(response);
                let length = payload.length;
                let data: WallboxDailyData = {
                    energy: new Array(length),
                };

                for (let i = 0; i < length; ++i) {
                    data.energy[i] = payload[i];
                }

                console.log('energy ' + id + ' ' +  data.energy);

                this.wallbox_daily_cache[id] = data;
            }
        }
    }

    async update_energy_manager_daily_cache() {
        let response: string = '';
        let year: number = 2023;
        let month: number = 2;
        let id = `${year}-${month}`;

        try {
            response = await (await util.put('energy_manager/analysis_energy_manager_daily', {year: year, month: month})).text();
        } catch (e) {
            console.log('Could not get energy manager daily data: ' + e);
        }

        if (response) {
            let payload = JSON.parse(response);
            let length = Math.floor(payload.length / 14);
            let data: EnergyManagerDailyData = {
                energy_grid_in: new Array(length),
                energy_grid_out: new Array(length),
                energy_meter_in_0: new Array(length),
                energy_meter_in_1: new Array(length),
                energy_meter_in_2: new Array(length),
                energy_meter_in_3: new Array(length),
                energy_meter_in_4: new Array(length),
                energy_meter_in_5: new Array(length),
                energy_meter_out_0: new Array(length),
                energy_meter_out_1: new Array(length),
                energy_meter_out_2: new Array(length),
                energy_meter_out_3: new Array(length),
                energy_meter_out_4: new Array(length),
                energy_meter_out_5: new Array(length),
            };

            for (let i = 0; i < length; ++i) {
                data.energy_grid_in[i] = payload[i * 14];
                data.energy_grid_out[i] = payload[i * 14 + 1];
                data.energy_meter_in_0[i] = payload[i * 14 + 2];
                data.energy_meter_in_1[i] = payload[i * 14 + 3];
                data.energy_meter_in_2[i] = payload[i * 14 + 4];
                data.energy_meter_in_3[i] = payload[i * 14 + 5];
                data.energy_meter_in_4[i] = payload[i * 14 + 6];
                data.energy_meter_in_5[i] = payload[i * 14 + 7];
                data.energy_meter_out_0[i] = payload[i * 14 + 8];
                data.energy_meter_out_1[i] = payload[i * 14 + 9];
                data.energy_meter_out_2[i] = payload[i * 14 + 10];
                data.energy_meter_out_3[i] = payload[i * 14 + 11];
                data.energy_meter_out_4[i] = payload[i * 14 + 12];
                data.energy_meter_out_5[i] = payload[i * 14 + 13];
            }

            console.log('energy_grid_in ' + id + ' ' + data.energy_grid_in);
            console.log('energy_grid_out ' + id + ' ' + data.energy_grid_out);
            console.log('energy_meter_in_0 ' + id + ' ' + data.energy_meter_in_0);
            console.log('energy_meter_in_1 ' + id + ' ' + data.energy_meter_in_1);
            console.log('energy_meter_in_2 ' + id + ' ' + data.energy_meter_in_2);
            console.log('energy_meter_in_3 ' + id + ' ' + data.energy_meter_in_3);
            console.log('energy_meter_in_4 ' + id + ' ' + data.energy_meter_in_4);
            console.log('energy_meter_in_5 ' + id + ' ' + data.energy_meter_in_5);
            console.log('energy_meter_out_0 ' + id + ' ' + data.energy_meter_out_0);
            console.log('energy_meter_out_1 ' + id + ' ' + data.energy_meter_out_1);
            console.log('energy_meter_out_2 ' + id + ' ' + data.energy_meter_out_2);
            console.log('energy_meter_out_3 ' + id + ' ' + data.energy_meter_out_3);
            console.log('energy_meter_out_4 ' + id + ' ' + data.energy_meter_out_4);
            console.log('energy_meter_out_5 ' + id + ' ' + data.energy_meter_out_5);

            this.energy_manager_daily_cache[id] = data;
        }
    }*/

    set_current_5min_date(date: Date) {
        this.setState({current_5min_date: date}, () => {
            this.update_current_5min_cache();
        });
    }

    reload_wallbox_cache() {
        if (this.uplot_wrapper_ref.current) {
            this.uplot_wrapper_ref.current.set_loading();
        }

        this.wallbox_5min_cache = {};

        this.update_wallbox_5min_cache_all(this.state.current_5min_date)
            .then((success: boolean) => {
                if (!success) {
                    window.setTimeout(() => {
                        this.reload_wallbox_cache();
                    }, 100);

                    return;
                }

                this.update_uplot();
            });

        // FIXME: reload daily cache as well
    }

    update_current_5min_cache() {
        if (this.uplot_wrapper_ref.current) {
            this.uplot_wrapper_ref.current.set_loading();
        }

        this.update_wallbox_5min_cache_all(this.state.current_5min_date)
            .then((success: boolean) => {
                if (!success) {
                    return Promise.resolve(false);
                }

                return this.update_energy_manager_5min_cache(this.state.current_5min_date);
            })
            .then((success: boolean) => {
                if (!success) {
                    window.setTimeout(() => {
                        this.update_current_5min_cache();
                    }, 100);

                    return;
                }

                this.update_uplot();
            });
    }

    schedule_uplot_update() {
        if (this.uplot_update_timeout) {
            window.clearTimeout(this.uplot_update_timeout);
        }

        this.uplot_update_timeout = window.setTimeout(() => {
            this.uplot_update_timeout = null;
            this.update_uplot();
        }, 100);
    }

    update_uplot() {
        if (this.uplot_wrapper_ref.current) {
            this.update_uplot_5min_cache(this.state.current_5min_date);

            let key = this.date_to_5min_key(this.state.current_5min_date);
            let data = this.uplot_5min_cache[key];

            this.uplot_wrapper_ref.current.set_data(data);
        }

        if (this.status_ref.current && this.status_ref.current.uplot_wrapper_ref.current) {
            let status_date: Date = new Date();

            status_date.setHours(0);
            status_date.setMinutes(0);
            status_date.setSeconds(0);
            status_date.setMilliseconds(0);

            this.update_uplot_5min_status_cache(status_date);

            let key = this.date_to_5min_key(status_date);
            let data = this.uplot_5min_status_cache[key];

            this.status_ref.current.uplot_wrapper_ref.current.set_data(data);
        }
    }

    render(props: {}, state: Readonly<EMEnergyAnalysisState>) {
        //if (!util.allow_render) {
        //    return (<></>);
        //}
        // TODO Add this back in. It's commented out because otherwise the stuff below won't render because this module doesn't have any event listeners to trigger rendering later.

        return (
            <>
                <PageHeader title={__("em_energy_analysis.content.em_energy_analysis")} colClasses="col-xl-10"/>
                <div class="row">
                    <div class="col-xl-10 mb-3">
                        <UplotWrapper ref={this.uplot_wrapper_ref} id="em_energy_analysis_chart" class="em-energy-analysis-chart" sidebar_id="em-energy-analysis" y_min={undefined} y_max={undefined} />
                    </div>
                </div>
                <FormRow label={__("em_energy_analysis.content.date")} labelColClasses="col-lg-3 col-xl-3" contentColClasses="col-lg-9 col-xl-7">
                    <InputDate date={state.current_5min_date} onDate={this.set_current_5min_date.bind(this)} buttons="day"/>
                </FormRow>
            </>
        )
    }
}

let status_ref = createRef();

render(<EMEnergyAnalysisStatusChart ref={status_ref} />, $('#status_em_energy_analysis_status_chart_container')[0]);

render(<EMEnergyAnalysis status_ref={status_ref} />, $('#em-energy-analysis')[0]);

function update_meter_values() {
    let values = API.get('meter/values');

    $('#status_em_energy_analysis_status_grid_connection_power').val(util.toLocaleFixed(values.power, 0) + " W");
}

export function init() {

}

export function add_event_listeners(source: API.APIEventTarget) {
    source.addEventListener('meter/values', update_meter_values);
}

export function update_sidebar_state(module_init: any) {
    $('#sidebar-em-energy-analysis').prop('hidden', !module_init.energy_manager);
}
