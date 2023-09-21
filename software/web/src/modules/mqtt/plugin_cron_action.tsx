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

import { CronActionID } from "../cron/cron_defs";

export type MqttCronAction = [
    CronActionID.MQTT,
    {
        topic: string,
        payload: string,
        retain: boolean,
        use_prefix: boolean
    }
];

import { Cron } from "../cron/main";
import { CronComponent, CronAction } from "../cron/types";
import { InputText } from "../../ts/components/input_text";
import { h, Fragment } from "preact"
import { Switch } from "../../ts/components/switch";
import { __ } from "../../ts/translation";
import * as API from "../../ts/api"
import { useState } from "preact/hooks";

export function MqttCronActionComponent(action: CronAction): CronComponent {
    const value = (action as MqttCronAction)[1];
    const mqtt_config = API.get("mqtt/config");
    const topic = value.use_prefix ? mqtt_config.global_topic_prefix + "/cron_action/" + value.topic : value.topic;

    const fieldNames = [
        __("mqtt.content.topic"),
        __("mqtt.content.payload"),
        __("mqtt.content.accept_retain")
    ];
    const fieldValues = [
        topic,
        value.payload,
        value.retain ? __("mqtt.content.yes") : __("mqtt.content.no")
    ]
    let ret = "";
    fieldNames.map((name, idx) => {
        ret += name + ": \"" + fieldValues[idx] + "\"" + (idx != fieldNames.length - 1 ? ", " : "");
    });
    return {
        text: ret,
        fieldNames: fieldNames,
        fieldValues: fieldValues
    };
}

export function MqttCronActionConfig(cron: Cron, action: CronAction) {
    let value = (action as MqttCronAction)[1];
    const mqtt_config = API.get("mqtt/config");
    const [isInvalid, isInvalidSetter] = useState(false);

    return [
        {
            name: __("mqtt.content.use_topic_prefix"),
            value: <Switch
                checked={value.use_prefix}
                onClick={() => {
                    value.use_prefix = !value.use_prefix;
                    cron.setActionFromComponent(action);
                }}
                desc={__("mqtt.content.use_topic_prefix_muted") + mqtt_config.global_topic_prefix}/>
        },
        {
            name: __("mqtt.content.topic"),
            value: <>
             <InputText
                value={value.topic}
                class={isInvalid ? "is-invalid" : undefined}
                onValue={(v) => {
                    value.topic = v;
                    if (value.topic.startsWith(mqtt_config.global_topic_prefix)) {
                        isInvalidSetter(true);
                    } else {
                        isInvalidSetter(false);
                    }
                    cron.setActionFromComponent(action);
                }}
                invalidFeedback={__("mqtt.content.use_topic_prefix_invalid")}/>
                <InputText
                    class="mt-2"
                    value={mqtt_config.global_topic_prefix + "/cron_action/" + value.topic}
                    hidden={!value.use_prefix} />
            </>
        },
        {
            name: __("mqtt.content.payload"),
            value: <InputText
                value={value.payload}
                onValue={(v) => {
                    value.payload = v;
                    cron.setActionFromComponent(action);
                }}/>
        },
        {
            name: __("mqtt.content.accept_retain"),
            value: <Switch
                checked={value.retain}
                onClick={() => {
                    value.retain = !value.retain;
                    cron.setActionFromComponent(action);
                }}/>
        }
    ]
}

function MqttCronActionFactory(): CronAction {
    return [
        CronActionID.MQTT,
        {
            topic: "",
            payload: "",
            retain: false,
            use_prefix: false
        }
    ]
}

export function init() {
    return {
        action_components: {
            [CronActionID.MQTT]: {
                clone: (action: CronAction) => [action[0], {...action[1]}] as CronAction,
                config_builder: MqttCronActionFactory,
                config_component: MqttCronActionConfig,
                table_row: MqttCronActionComponent,
                name: __("mqtt.content.mqtt")
            }
        }
    };
}
