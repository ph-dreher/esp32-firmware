/* esp32-firmware
 * Copyright (C) 2020-2021 Erik Fleckstein <erik@tinkerforge.com>
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
import { __ } from "../../ts/translation";
import { h, ComponentChildren } from "preact";
import { NavbarGroup } from "../../ts/components/navbar_group";
import { BatteryCharging } from "react-feather";

export function EVSEGroupNavbar(props: {children: ComponentChildren}) {
    return (
        <NavbarGroup name="evse" title={__("evse_group.navbar.evse_group")} symbol={<BatteryCharging />}>
            {props.children}
        </NavbarGroup>);
}

export function init() {
}

export function add_event_listeners(source: API.APIEventTarget) {
}

export function update_sidebar_state(module_init: any) {
    document.getElementById("sidebar-evse-group").hidden = false;
}