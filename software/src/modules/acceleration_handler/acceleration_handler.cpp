#include "acceleration_handler.h"

#include "bindings/errors.h"
#include "event_log_prefix.h"
#include "module_dependencies.h"

#include "esp_wifi.h"

extern TF_HAL hal;

AccelerationHandler::SensorPeer::SensorPeer(const char *hostname)
    : hostname(hostname)
{
    ipcon_create(&ipcon);
    logger.printfln("Connecting to %s...", hostname);
    int result = ipcon_connect(&ipcon, hostname, port);
    if (result == TF_E_OK)
    {
        logger.printfln("Connected. Enumerating devices...");
        ipcon_register_callback(&ipcon, IPCON_CALLBACK_ENUMERATE, (void (*)())enumerate_callback,
            this);
        ipcon_enumerate(&ipcon);
    }
    else
        logger.printfln("Unable to connect to %s: %d", hostname, result);
}

AccelerationHandler::SensorPeer::~SensorPeer()
{
    if (accelerometer)
        accelerometer_v2_destroy(accelerometer.get());
    ipcon_destroy(&ipcon);
}

void AccelerationHandler::SensorPeer::acceleration_callback(int32_t x, int32_t y, int32_t z,
    void *user_data)
{
    SensorPeer *sensorPeer = (SensorPeer *)user_data;
    sensorPeer->current_values[0] = x;
    sensorPeer->current_values[1] = y;
    sensorPeer->current_values[2] = z;
}

void AccelerationHandler::SensorPeer::enumerate_callback(const char *uid, const char *connected_uid,
    char position, uint8_t hardware_version[3], uint8_t firmware_version[3],
    uint16_t device_identifier, uint8_t enumeration_type, void *user_data)
{
    if((enumeration_type == IPCON_ENUMERATION_TYPE_CONNECTED ||
            enumeration_type == IPCON_ENUMERATION_TYPE_AVAILABLE) &&
        device_identifier == ACCELEROMETER_V2_DEVICE_IDENTIFIER)
    {
        SensorPeer *sensorPeer = (SensorPeer *)user_data;
        logger.printfln("Found accelerometer %s, enumeration type %d", uid, (int)enumeration_type);
        sensorPeer->accelerometer.reset(new AccelerometerV2());
        sensorPeer->uid = uid;
        accelerometer_v2_create(sensorPeer->accelerometer.get(), uid, &sensorPeer->ipcon);
        uint8_t full_scale;
        if (acceleration_scale_mg <= 2000)
            full_scale = ACCELEROMETER_V2_FULL_SCALE_2G;
        else if (acceleration_scale_mg <= 4000)
            full_scale = ACCELEROMETER_V2_FULL_SCALE_4G;
        else 
            full_scale = ACCELEROMETER_V2_FULL_SCALE_8G;
        accelerometer_v2_set_configuration(sensorPeer->accelerometer.get(), data_rate, full_scale);
        accelerometer_v2_register_callback(sensorPeer->accelerometer.get(),
            ACCELEROMETER_V2_CALLBACK_ACCELERATION, (void (*)())acceleration_callback, sensorPeer);
        accelerometer_v2_set_acceleration_callback_configuration(sensorPeer->accelerometer.get(),
            1, true);
    }
}

bool AccelerationHandler::SensorPeer::is_host(const char *hostname) const
{
    return this->hostname == hostname;
}

bool AccelerationHandler::SensorPeer::is_valid() const
{
    return (bool)accelerometer;
}

int32_t AccelerationHandler::SensorPeer::get_current_value(AccelerationHandler::Axis axis) const
{
    return current_values[(int)axis];
}

void AccelerationHandler::setup()
{
    int analogOutResult = tf_industrial_analog_out_v2_create(&industrial_analog_out_v2, nullptr,
        &hal);
    if (analogOutResult == TF_E_OK)
    {
        tf_industrial_analog_out_v2_set_out_led_status_config(&industrial_analog_out_v2,
            min_current_ma * 1000, max_current_ma * 1000,
            TF_INDUSTRIAL_ANALOG_OUT_V2_OUT_LED_STATUS_CONFIG_INTENSITY);
        tf_industrial_analog_out_v2_set_out_led_config(&industrial_analog_out_v2,
            TF_INDUSTRIAL_ANALOG_OUT_V2_OUT_LED_CONFIG_SHOW_OUT_STATUS);
        tf_industrial_analog_out_v2_set_enabled(&industrial_analog_out_v2, true);
    }
    else
        logger.printfln("Failed to initialize analog out: %d", analogOutResult);
}

void AccelerationHandler::register_events()
{
    event.registerEvent("wifi/state", {"ap_sta_count"}, [this](const Config *ap_sta_count) {
        update_connected();
        return EventResult::OK;
    });
}

void AccelerationHandler::update_connected()
{
    // A device has connected or disconnected from us. Check if we need to connect to new sensors.
    logger.printfln("update_connected() called.");

    wifi_sta_list_t sta_list;
    tcpip_adapter_sta_list_t ip_sta_list;

    // Get the list of connected stations (clients)
    if (esp_wifi_ap_get_sta_list(&sta_list) == ESP_OK) {
        if (tcpip_adapter_get_sta_list(&sta_list, &ip_sta_list) == ESP_OK) {
            // Iterate over the connected stations
            for (int i = 0; i < ip_sta_list.num; ++i) {
                tcpip_adapter_sta_info_t *station = &ip_sta_list.sta[i];

                char hostname[40];
                snprintf(hostname, sizeof(hostname), IPSTR, IP2STR(&station->ip));
                bool found = false;
                for (const auto& peer : peers)
                {
                    if (peer.is_host(hostname))
                    {
                        logger.printfln("Host %s already known.", hostname);
                        found = true;
                        break;
                    }
                }
                if (!found)
                {
                    logger.printfln("Host %s is new.", hostname);
                    peers.emplace_back(hostname);
                }
            }
        } else {
            logger.printfln("Failed to get IP list of connected stations");
        }
    } else {
        logger.printfln("Failed to get station list");
    }
}

void AccelerationHandler::loop()
{
    for (const SensorPeer& peer : peers)
    {
        if (!peer.is_valid())
            continue;
        uint16_t current = 0;
        int32_t value = peer.get_current_value(acceleration_axis);
#ifdef LOG_VALUES
        const int32_t unclamped_value = value;
#endif
        const int32_t acceleration_scale = acceleration_scale_mg * 10;
        // Clamp value.
        if (value < -acceleration_scale)
            value = -acceleration_scale;
        if (value > acceleration_scale)
            value = acceleration_scale;

        const int32_t current_range_ua = (max_current_ma - min_current_ma) * 1000;
        if (current_range_ua <= 0)
            logger.printfln("Invalid current range %d - %d.", min_current_ma, max_current_ma);
        else
        {
            const int32_t mapped_current_ua = min_current_ma * 1000 +
                (value - (-acceleration_scale)) * current_range_ua / (acceleration_scale * 2);
            if (mapped_current_ua < min_current_ma * 1000 ||
                mapped_current_ua > max_current_ma * 1000)
            {
                logger.printfln("Overflow when calculating current for value %d.", value);
            }
            else
                current = (uint16_t)mapped_current_ua;
        }

#ifdef LOG_VALUES
        TickType_t ticks = xTaskGetTickCount();
        if (ticks - lastPrint > 1000)
        {
            lastPrint = ticks;
            logger.printfln("Clamped value: %d (was %d), resulting current: %d", (int)value,
                (int)unclamped_value, (int)current);
        }
#endif

        int result = tf_industrial_analog_out_v2_set_current(&industrial_analog_out_v2, current);
        if (result != TF_E_OK)
            logger.printfln("Error setting current: %d", result);

        break;
    }
}
