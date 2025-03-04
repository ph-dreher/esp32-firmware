specs = [
    {
        'name': 'Solax Hybrid Inverter',
        'register_type': 'InputRegister',
        'values': [
            {
                'name': 'Energy Total To Grid [0.1 kWh]',
                'value_id': 'EnergyActiveLSumExport',
                'start_address': 0x52,
                'value_type': 'U32LE',
                'scale_factor': 0.1,
            },
        ],
    },
    {
        'name': 'Solax Hybrid Inverter Grid',
        'register_type': 'InputRegister',
        'values': [
            {
                'name': 'Feedin Power [W]',
                'value_id': 'PowerActiveLSumImExDiff',
                'start_address': 0x46,
                'value_type': 'S32LE',
                'scale_factor': -1.0,
            },
            {
                'name': 'Feedin Energy Total [0.01 kWh]',
                'value_id': 'EnergyActiveLSumExport',
                'start_address': 0x48,
                'value_type': 'U32LE',
                'scale_factor': 0.01,
            },
            {
                'name': 'Consume Energy Total [0.01 kWh]',
                'value_id': 'EnergyActiveLSumImport',
                'start_address': 0x4A,
                'value_type': 'U32LE',
                'scale_factor': 0.01,
            },
            {
                'name': 'Grid Reactive Power Total Meter [var]',
                'value_id': 'PowerReactiveLSumIndCapDiff',  # FIXME: direction?
                'start_address': 0xC0,
                'value_type': 'S16',
            },
            {
                'name': 'Grid Reactive Power R Meter [var]',
                'value_id': 'PowerReactiveL1IndCapDiff',  # FIXME: direction?
                'start_address': 0xC1,
                'value_type': 'S16',
            },
            {
                'name': 'Grid Reactive Power S Meter [var]',
                'value_id': 'PowerReactiveL2IndCapDiff',  # FIXME: direction?
                'start_address': 0xC2,
                'value_type': 'S16',
            },
            {
                'name': 'Grid Reactive Power T Meter [var]',
                'value_id': 'PowerReactiveL3IndCapDiff',  # FIXME: direction?
                'start_address': 0xC3,
                'value_type': 'S16',
            },
            {
                'name': 'Grid Power Factor Total Meter [0.01]',
                'value_id': 'PowerFactorLSumDirectional',
                'start_address': 0xC4,
                'value_type': 'S16',
                'scale_factor': -0.01,
            },
            {
                'name': 'Grid Power Factor R Meter [0.01]',
                'value_id': 'PowerFactorL1Directional',
                'start_address': 0xC5,
                'value_type': 'S16',
                'scale_factor': -0.01,
            },
            {
                'name': 'Grid Power Factor S Meter [0.01]',
                'value_id': 'PowerFactorL2Directional',
                'start_address': 0xC6,
                'value_type': 'S16',
                'scale_factor': -0.01,
            },
            {
                'name': 'Grid Power Factor T Meter [0.01]',
                'value_id': 'PowerFactorL3Directional',
                'start_address': 0xC7,
                'value_type': 'S16',
                'scale_factor': -0.01,
            },
            {
                'name': 'Grid Frequency Meter [0.01 Hz]',
                'value_id': 'FrequencyLAvg',
                'start_address': 0xC8,
                'value_type': 'U16',
                'scale_factor': 0.01,
            },
            {
                'name': 'Grid Voltage Total Meter [0.1 V]',
                'value_id': 'VoltageLNAvg',
                'start_address': 0xC9,
                'value_type': 'U16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Grid Voltage R Meter [0.1 V]',
                'value_id': 'VoltageL1N',
                'start_address': 0xCA,
                'value_type': 'U16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Grid Voltage S Meter [0.1 V]',
                'value_id': 'VoltageL2N',
                'start_address': 0xCB,
                'value_type': 'U16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Grid Voltage T Meter [0.1 V]',
                'value_id': 'VoltageL3N',
                'start_address': 0xCC,
                'value_type': 'U16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Grid Current Total Meter [0.1 A]',
                'value_id': 'CurrentLSumImExSum',
                'start_address': 0xCD,
                'value_type': 'S16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Grid Current R Meter [0.1 A]',
                'value_id': 'CurrentL1ImExSum',
                'start_address': 0xCE,
                'value_type': 'S16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Grid Current S Meter [0.1 A]',
                'value_id': 'CurrentL2ImExSum',
                'start_address': 0xCF,
                'value_type': 'S16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Grid Current T Meter [0.1 A]',
                'value_id': 'CurrentL3ImExSum',
                'start_address': 0xD0,
                'value_type': 'S16',
                'scale_factor': 0.1,
            },
        ],
    },
    {
        'name': 'Solax Hybrid Inverter Battery',
        'register_type': 'InputRegister',
        'values': [
            {
                'name': 'Battery Voltage [0.1 V]',
                'value_id': 'VoltageDC',
                'start_address': 0x14,
                'value_type': 'S16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Battery Current [0.1 A]',
                'value_id': 'CurrentDCChaDisDiff',
                'start_address': 0x15,
                'value_type': 'S16',
                'scale_factor': 0.1,
            },
            {
                'name': 'Battery Power [W]',
                'value_id': 'PowerDCChaDisDiff',
                'start_address': 0x16,
                'value_type': 'S16',
            },
            {
                'name': 'Battery Temperature [°C]',
                'value_id': 'Temperature',
                'start_address': 0x18,
                'value_type': 'S16',
            },
            {
                'name': 'Battery State Of Charge [%]',
                'value_id': 'StateOfCharge',
                'start_address': 0x1C,
                'value_type': 'U16',
            },
            {
                'name': 'Output Energy [0.1 kWh]',
                'value_id': 'EnergyDCDischarge',
                'start_address': 0x1D,
                'value_type': 'U32LE',
                'scale_factor': 0.1,
            },
            {
                'name': 'Input Energy [0.1 kWh]',
                'value_id': 'EnergyDCCharge',
                'start_address': 0x21,
                'value_type': 'U32LE',
                'scale_factor': 0.1,
            },
        ],
    },
]
