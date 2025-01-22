#pragma once

#include "module.h"
#include "bindings/bricklet_industrial_analog_out_v2.h"

#include "tkapi/ip_connection.h"
#include "tkapi/bricklet_accelerometer_v2.h"

#include <memory>
#include <string>
#include <vector>

// #define LOG_VALUES

class AccelerationHandler final : public IModule
{
public:
    enum class Axis
    {
        X,
        Y,
        Z
    };

    /**
     * The output current representing an acceleration of -accelerationScaleG, in milliamperes.
     */
    static const uint16_t min_current_ma = 4;
    /**
     * The output current representing an acceleration of +accelerationScaleG, in milliamperes.
     */
    static const uint16_t max_current_ma = 20;

    /**
     * The scaling of the transformation from acceleration to current. Values of
     * -accelerationScaleMg or beyond will be mapped to minCurrentMa. Values of +accelerationScaleMg
     * or beyond will be mapped to maxCurrentMa. Values of 0 will be mapped to (minCurrentMa +
     * maxCurrentMa) / 2. The unit of acceleration is milli-gn (thousands of a gn,
     * 1 gn = 9,80665m/s²). The maximum value the accelerometer can measure is 8000 milli-gn.
     */
    static const uint16_t acceleration_scale_mg = 2000;

    /**
     * The data rate to be used for the accelerometer. According to the Tinkerforge docs, a lower
     * data rate reduces noise. Reading values in real time apparently works only up to 1000 Hz. For
     * higher values, data would have to be read in batches.
     */
    static const uint8_t data_rate = ACCELEROMETER_V2_DATA_RATE_800HZ;

    /**
     * The accelerometer axis whose data is to be output via the analog output.
     */
    static const Axis acceleration_axis = Axis::Y;

    AccelerationHandler() {}
    void setup() override;
    void register_events() override;
    void loop() override;

private:
    class SensorPeer
    {
        private:
            const std::string hostname;
            IPConnection ipcon;
            std::shared_ptr<AccelerometerV2> accelerometer;
            std::string uid;

            int32_t current_values[3] = { };

            static void acceleration_callback(int32_t x, int32_t y, int32_t z, void *user_data);
            static void enumerate_callback(const char *uid, const char *connected_uid,
                char position, uint8_t hardware_version[3], uint8_t firmware_version[3],
                uint16_t device_identifier, uint8_t enumeration_type, void *user_data);

        public:
            static const uint16_t port = 4223;

            SensorPeer(const char *hostname);
            ~SensorPeer();

            int32_t get_current_value(Axis axis) const;
            bool is_host(const char *hostname) const;
            bool is_valid() const;
    };

    TF_IndustrialAnalogOutV2 industrial_analog_out_v2;
    std::vector<SensorPeer> peers;

#ifdef LOG_VALUES
    TickType_t lastPrint = 0;
#endif

    void update_connected();
};
