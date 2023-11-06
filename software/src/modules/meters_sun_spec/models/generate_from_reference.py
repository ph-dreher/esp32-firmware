#!/usr/bin/python3

import glob
import io
import os
import re
import shutil
import sys
from xlsx2csv import Xlsx2csv

xlsx_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "..", "..", "..", "..", "wallbox", "sunspec", "SunSpec_Information_Model_Reference_20211209.xlsx")
model_ids = [1, 101, 102, 103, 111, 112, 113,  201, 202, 203, 204, 211, 212, 213, 214]

value_id_mappings_inverter = {
    "A"       : [ "CurrentLSumExport",           None  ],
    "AphA"    : [ "CurrentL1Export",             None  ],
    "AphB"    : [ "CurrentL2Export",             None  ],
    "AphC"    : [ "CurrentL3Export",             None  ],
    "DCA"     : [ "CurrentDC",                   None  ],
    "DCV"     : [ "VoltageDC",                   None  ],
    "DCW"     : [ "PowerDC",                     None  ],
    "Hz"      : [ "FrequencyLAvg",               None  ],
    "PF"      : [ "PowerFactorLSumDirectional",  0.01  ],
    "PhVphA"  : [ "VoltageL1N",                  None  ],
    "PhVphB"  : [ "VoltageL2N",                  None  ],
    "PhVphC"  : [ "VoltageL3N",                  None  ],
    "PPVphAB" : [ "VoltageL1L2",                 None  ],
    "PPVphBC" : [ "VoltageL2L3",                 None  ],
    "PPVphCA" : [ "VoltageL3L1",                 None  ],
    "TmpCab"  : [ "Temperature1",                None  ], # Reihenfolge des Models
    "TmpOt"   : [ "Temperature4",                None  ],
    "TmpSnk"  : [ "Temperature2",                None  ],
    "TmpTrns" : [ "Temperature3",                None  ],
    "VA"      : [ "PowerApparentLSum",           None  ],
    "VAr"     : [ "PowerReactiveLSumIndCapDiff", None  ],
    "W"       : [ "PowerReactiveLSumIndCapDiff", None  ],
    "WH"      : [ "EnergyActiveLSumExport",      0.001 ],
}

value_id_mappings_meter = {
    "PhVphA"          : [ "VoltageL1N",                  None  ],
    "PhVphB"          : [ "VoltageL2N",                  None  ],
    "PhVphC"          : [ "VoltageL3N",                  None  ],
    "PhVphAB"         : [ "VoltageL1L2",                 None  ],
    "PPVphAB"         : [ "VoltageL1L2",                 None  ],
    "PhVphBC"         : [ "VoltageL2L3",                 None  ],
    "PPVphBC"         : [ "VoltageL2L3",                 None  ],
    "PhVphCA"         : [ "VoltageL3L1",                 None  ],
    "PPVphCA"         : [ "VoltageL3L1",                 None  ],
    "PhV"             : [ "VoltageLNAvg",                None  ],
    "PPV"             : [ "VoltageLLAvg",                None  ],
    "AphA"            : [ "CurrentL1ImExDiff",           None  ],
    "AphB"            : [ "CurrentL2ImExDiff",           None  ],
    "AphC"            : [ "CurrentL3ImExDiff",           None  ],
    "A"               : [ "CurrentLSumImExDiff",         None  ],

    "WphA"            : [ "PowerActiveL1ImExDiff",       None  ],
    "WphB"            : [ "PowerActiveL2ImExDiff",       None  ],
    "WphC"            : [ "PowerActiveL3ImExDiff",       None  ],
    "W"               : [ "PowerActiveLSumImExDiff",     None  ],
    "VARphA"          : [ "PowerReactiveL1IndCapDiff",   None  ],
    "VARphB"          : [ "PowerReactiveL2IndCapDiff",   None  ],
    "VARphC"          : [ "PowerReactiveL3IndCapDiff",   None  ],
    "VAR"             : [ "PowerReactiveLSumIndCapDiff", None  ],
    "VAphA"           : [ "PowerApparentL1",             None  ],
    "VAphB"           : [ "PowerApparentL2",             None  ],
    "VAphC"           : [ "PowerApparentL3",             None  ],
    "VA"              : [ "PowerApparentLSum",           None  ],

    "TotWhImpPhA"     : [ "EnergyActiveL1Import",        0.001 ],
    "TotWhExpPhA"     : [ "EnergyActiveL1Export",        0.001 ],
    "TotWhImpPhB"     : [ "EnergyActiveL2Import",        0.001 ],
    "TotWhExpPhB"     : [ "EnergyActiveL2Export",        0.001 ],
    "TotWhImpPhC"     : [ "EnergyActiveL3Import",        0.001 ],
    "TotWhExpPhC"     : [ "EnergyActiveL3Export",        0.001 ],
    "TotWhImp"        : [ "EnergyActiveLSumImport",      0.001 ],
    "TotWhExp"        : [ "EnergyActiveLSumExport",      0.001 ],

    "TotVArhImpQ1PhA" : [ "EnergyReactiveQ1L1",          0.001 ],
    "TotVArhImpQ1PhB" : [ "EnergyReactiveQ1L2",          0.001 ],
    "TotVArhImpQ1PhC" : [ "EnergyReactiveQ1L3",          0.001 ],
    "TotVArhImpQ1"    : [ "EnergyReactiveQ1LSum",        0.001 ],
    "TotVArhImpQ2PhA" : [ "EnergyReactiveQ2L1",          0.001 ],
    "TotVArhImpQ2PhB" : [ "EnergyReactiveQ2L2",          0.001 ],
    "TotVArhImpQ2PhC" : [ "EnergyReactiveQ2L3",          0.001 ],
    "TotVArhImpQ2"    : [ "EnergyReactiveQ2LSum",        0.001 ],
    "TotVArhExpQ3PhA" : [ "EnergyReactiveQ3L1",          0.001 ],
    "TotVArhExpQ3PhB" : [ "EnergyReactiveQ3L2",          0.001 ],
    "TotVArhExpQ3PhC" : [ "EnergyReactiveQ3L3",          0.001 ],
    "TotVArhExpQ3"    : [ "EnergyReactiveQ3LSum",        0.001 ],
    "TotVArhExpQ4PhA" : [ "EnergyReactiveQ4L1",          0.001 ],
    "TotVArhExpQ4PhB" : [ "EnergyReactiveQ4L2",          0.001 ],
    "TotVArhExpQ4PhC" : [ "EnergyReactiveQ4L3",          0.001 ],
    "TotVArhExpQ4"    : [ "EnergyReactiveQ4LSum",        0.001 ],

    "TotVArhImpQ1phA" : [ "EnergyReactiveQ1L1",          0.001 ],
    "TotVArhImpQ1phB" : [ "EnergyReactiveQ1L2",          0.001 ],
    "TotVArhImpQ1phC" : [ "EnergyReactiveQ1L3",          0.001 ],
    "TotVArhImpQ1"    : [ "EnergyReactiveQ1LSum",        0.001 ],
    "TotVArhImpQ2phA" : [ "EnergyReactiveQ2L1",          0.001 ],
    "TotVArhImpQ2phB" : [ "EnergyReactiveQ2L2",          0.001 ],
    "TotVArhImpQ2phC" : [ "EnergyReactiveQ2L3",          0.001 ],
    "TotVArhImpQ2"    : [ "EnergyReactiveQ2LSum",        0.001 ],
    "TotVArhExpQ3phA" : [ "EnergyReactiveQ3L1",          0.001 ],
    "TotVArhExpQ3phB" : [ "EnergyReactiveQ3L2",          0.001 ],
    "TotVArhExpQ3phC" : [ "EnergyReactiveQ3L3",          0.001 ],
    "TotVArhExpQ3"    : [ "EnergyReactiveQ3LSum",        0.001 ],
    "TotVArhExpQ4phA" : [ "EnergyReactiveQ4L1",          0.001 ],
    "TotVArhExpQ4phB" : [ "EnergyReactiveQ4L2",          0.001 ],
    "TotVArhExpQ4phC" : [ "EnergyReactiveQ4L3",          0.001 ],
    "TotVArhExpQ4"    : [ "EnergyReactiveQ4LSum",        0.001 ],

    "TotVAhImpPhA"    : [ "EnergyApparentL1Import",      0.001 ],
    "TotVAhExpPhA"    : [ "EnergyApparentL1Export",      0.001 ],
    "TotVAhImpPhB"    : [ "EnergyApparentL2Import",      0.001 ],
    "TotVAhExpPhB"    : [ "EnergyApparentL2Export",      0.001 ],
    "TotVAhImpPhC"    : [ "EnergyApparentL3Import",      0.001 ],
    "TotVAhExpPhC"    : [ "EnergyApparentL3Export",      0.001 ],
    "TotVAhImp"       : [ "EnergyApparentLSumImport",    0.001 ],
    "TotVAhExp"       : [ "EnergyApparentLSumExport",    0.001 ],

    "PFphA"           : [ "PowerFactorL1Directional",    None  ],
    "PFphB"           : [ "PowerFactorL2Directional",    None  ],
    "PFphC"           : [ "PowerFactorL3Directional",    None  ],
    "PF"              : [ "PowerFactorLSumDirectional",  None  ],
    "Hz"              : [ "FrequencyLAvg",               None  ],
}

# Unmapped SunSpec IDs
#    "ID"  : None,
#    "L"   : None,
#
#    "Evt" : None,
#    "DA"  : None,
#    "Md"  : None,
#    "Mn"  : None,
#    "Opt" : None,
#    "SN"  : None,
#    "Vr"  : None,
#    "Alg" : None,
#    "N"   : None,
#    "Ms"  : None,
#    "Seq" : None,
#    "Ts"  : None,
#
# Common
#    "V_SF"   : None,
#    "A_SF"   : None,
#    "W_SF"   : None,
#    "VAR_SF" : None,
#    "VAr_SF" : None,
#    "VA_SF"  : None,
#    "PF_SF"  : None,
#    "Hz_SF"  : None,
#
# Inverters only
#    "DCA_SF" : None,
#    "DCV_SF" : None,
#    "DCW_SF" : None,
#    "Tmp_SF" : None,
#    "WH_SF"  : None,
#
# Meters only
#    "TotWh_SF"   : None,
#    "TotVArh_SF" : None,
#    "TotVAh_SF"  : None,

for path in glob.glob("model_*.h"):
    os.remove(path)

models = []

for model_id in model_ids:
    csv = io.StringIO()
    Xlsx2csv(xlsx_path, outputencoding="utf-8").convert(csv, sheetname=str(model_id))

    csv.seek(0)
    line = csv.readline()
    line = csv.readline()

    model_name = line.split(",")[12]
    model_name = re.sub('^meter', '', model_name, flags=re.IGNORECASE)
    model_name = re.sub(r'\(.*?\)', '', model_name)
    model_name = re.sub(' {2,}', ' ', model_name)
    model_name = model_name.strip()
    if not re.search('[A-Z]{2}', model_name):
        model_name = model_name.title()

    model_name_mangled = model_name.replace("-", "_").replace(" ", "_")
    model_name_camel   = model_name_mangled.replace("_", "")
    model_name_upper   = model_name_mangled.upper()

    if model_id == 1:
        value_id_mappings = {}
    elif model_id >= 100 and model_id <= 199:
        value_id_mappings = value_id_mappings_inverter
    elif model_id >= 200 and model_id <= 299:
        value_id_mappings = value_id_mappings_meter
    else:
        print(f"No value ID mappings available for model ID {model_id}.", file=sys.stderr)
        exit(1)

    max_declaration_length = 0
    max_register = 0
    last_field_bytes = 0
    register_length = 0

    values = []

    csv.seek(0)
    for line in csv:
        fields       = line.split(",")
        register     = fields[0]
        name         = fields[2]
        field_type   = fields[5]
        scale_factor = fields[7]
        mandatory    = fields[10] == "M"
        field_bytes  = 0

        if not register.isnumeric():
            continue

        is_array = False

        if register == "0":
            if int(fields[3]) != model_id:
                print(f"Model ID found in table doesn't match requested model ID. {fields[3]} != {model_id}", file=sys.stderr)
                exit(1)

        if   field_type == "pad"        : continue # TODO pad in the middle should be allowed, only ignore at end
        elif field_type == "uint16"     : c_type = "uint16_t"
        elif field_type == "int16"      : c_type = "int16_t"
        elif field_type == "sunssf"     : c_type = "int16_t"
        elif field_type == "uint32"     : c_type = "uint32_t"
        elif field_type == "acc32"      : c_type = "uint32_t"
        elif field_type == "bitfield32" : c_type = "uint32_t"
        elif field_type == "enum16"     : c_type = "uint16_t"
        elif field_type == "float32"    : c_type = "uint32_t"
        elif field_type == "string":
            c_type = "char"
            field_length = int(fields[6]) * 2
            is_array = True

        if   c_type == "char"    : field_bytes = 1
        elif c_type == "uint16_t": field_bytes = 2
        elif c_type == "int16_t" : field_bytes = 2
        elif c_type == "uint32_t": field_bytes = 4
        elif c_type == "float"   : field_bytes = 4
        else:
            print(f"Field bytes for type '{field_type}' not known.", file=sys.stderr)
            exit(1)

        if field_bytes > 2:
            packed = "_ATTRIBUTE((packed))"
        else:
            packed = "                    "

        if is_array:
            field_bytes *= field_length
            declaration = name + f"[{field_length}];"
        else:
            declaration = name + ";"

        declaration_length = len(declaration)
        if declaration_length > max_declaration_length:
            max_declaration_length = declaration_length
        max_register = register
        last_field_bytes = field_bytes
        register_length = len(max_register)

        value_id_mapping = value_id_mappings.get(name)

        value = {}
        value['register']         = register
        value['name']             = name
        value['field_type']       = field_type
        value['scale_factor']     = scale_factor
        value['c_type']           = c_type
        value['packed']           = packed
        value['declaration']      = declaration
        value['value_id_mapping'] = value_id_mapping
        value['mandatory']        = mandatory

        values.append(value)

    del csv

    struct_name = f"SunSpec{model_name_camel}Model{model_id:03d}_s"
    union_name  = f"SunSpec{model_name_camel}Model{model_id:03d}_u"
    name_macro_name   = f"SUNSPEC_MODEL_{model_id:03d}_NAME"
    size_macro_name   = f"SUNSPEC_MODEL_{model_id:03d}_SIZE"
    length_macro_name = f"SUNSPEC_MODEL_{model_id:03d}_LENGTH"

    # make header
    struct_header_output = io.StringIO()

    def print_header(*args):
        print(*args, file=struct_header_output)

    delim = "// " + "=" * (6 + len(model_name))

    print_header(r'// WARNING: This file is generated.')
    print_header()
    print_header(r'#pragma once')
    print_header()
    print_header(r'#include <stdint.h>')
    print_header(r'#include <stdlib.h>')
    print_header()
    print_header(r'#if defined(__GNUC__)')
    print_header(r'    #pragma GCC diagnostic push')
    print_header(r'    #include "gcc_warnings.h"')
    print_header(r'    #pragma GCC diagnostic ignored "-Wattributes"')
    print_header(r'#endif')
    print_header()
    print_header(delim)
    print_header(f"// {model_id:03d} - {model_name}")
    print_header(delim)
    print_header()
    print_header(f"struct {struct_name} {{")

    for value in values:
        print_header(f"    {value['packed']} {value['c_type']:8} {value['declaration']:{max_declaration_length}} // {int(value['register']):>{register_length}d}")

    struct_size  = int(max_register) * 2 + last_field_bytes
    model_length = int(max_register) + int(last_field_bytes / 2) - 2

    print_header(r"};")
    print_header()
    print_header(f"#define {name_macro_name} \"{model_name}\"")
    print_header()
    print_header(r"// Total size in bytes, includes ID and length registers.")
    print_header(f"#define {size_macro_name} ({struct_size})")
    print_header()
    print_header(r"// Register count without ID and length registers, should match content of length register.")
    print_header(f"#define {length_macro_name} ({model_length})")
    print_header()
    print_header(f"union {union_name} {{")
    print_header(f"    struct {struct_name} model;")
    print_header(f"    uint16_t registers[{size_macro_name} / sizeof(uint16_t)];")
    print_header(r"};")
    print_header()
    print_header(f"static_assert(sizeof({struct_name}) == {struct_size}, \"Incorrect {model_name} length.\");")
    print_header(f"static_assert(sizeof({union_name}) == {struct_size}, \"Incorrect {model_name} length.\");")
    print_header(f"static_assert(sizeof(static_cast<{union_name} *>(nullptr)->registers) == {struct_size}, \"Incorrect {model_name} length.\");")
    print_header()
    print_header(r"#if defined(__GNUC__)")
    print_header(r"   #pragma GCC diagnostic pop")
    print_header(r"#endif")

    struct_header_output.seek(0)
    with open(f"model_{model_id:03d}.h", "w") as outfile:
        shutil.copyfileobj(struct_header_output, outfile)

    model = {}
    model['id']                 = model_id
    model['name']               = model_name
    model['name_mangled']       = model_name_mangled
    model['name_camel']         = model_name_camel
    model['name_upper']         = model_name_upper
    model['values']             = values
    model['struct_size']        = struct_size
    model['model_length']       = model_length
    model['struct_name']        = struct_name
    model['union_name']         = union_name
    model['name_macro_name']    = name_macro_name
    model['size_macro_name']    = size_macro_name
    model['length_macro_name']  = length_macro_name
    model['delimiter']          = delim

    models.append(model)

cpp_output = io.StringIO()

def print_cpp(*args, file=cpp_output):
    print(*args, file=file)

print_cpp(
r"""// WARNING: This file is generated.

#include <math.h>
#include <stdint.h>

#include "../model_parser.h"

#include "gcc_warnings.h"

#if defined(__GNUC__)
    #pragma GCC diagnostic ignored "-Wpedantic"
#endif

static const float scale_factors[21] = {
              0.0000000001f,    // 10^-10
              0.000000001f,     // 10^-9
              0.00000001f,      // 10^-8
              0.0000001f,       // 10^-7
              0.000001f,        // 10^-6
              0.00001f,         // 10^-5
              0.0001f,          // 10^-4
              0.001f,           // 10^-3
              0.01f,            // 10^-2
              0.1f,             // 10^-1
              1.0f,             // 10^0
             10.0f,             // 10^1
            100.0f,             // 10^2
           1000.0f,             // 10^3
          10000.0f,             // 10^4
         100000.0f,             // 10^5
        1000000.0f,             // 10^6
       10000000.0f,             // 10^7
      100000000.0f,             // 10^8
     1000000000.0f,             // 10^9
    10000000000.0f,             // 10^10
};

static float get_scale_factor(int32_t sunssf)
{
    if (sunssf < -10) {
        if (sunssf == INT16_MIN) { // scale factor not implemented
            return 1;
        } else {
            return NAN;
        }
    } else if (sunssf > 10) {
        return NAN;
    }
    return scale_factors[sunssf + 10];

}

static inline uint32_t convert_me_uint32(uint32_t me32)
{
    return me32 << 16 | me32 >> 16;
}

static inline float convert_me_float(uint32_t me32)
{
    union {
        float result;
        uint32_t u32;
    } uni;

    uni.u32 = convert_me_uint32(me32);
    return uni.result;
}
""")

for model in models:
    model_id = model['id']
    model_name = model['name']
    #model['name_mangled']      = model_name_mangled
    #model['name_camel']        = model_name_camel
    #model['name_upper']        = model_name_upper
    values = model['values']
    #model['struct_size']       = struct_size
    model_length = model['model_length']
    struct_name = model['struct_name']
    #model['union_name']        = union_name
    #model['name_macro_name']   = name_macro_name
    #model['size_macro_name']   = size_macro_name
    #model['length_macro_name'] = length_macro_name
    delimiter = model['delimiter']

    print_cpp(delimiter)
    print_cpp(f'// {model_id:03d} - {model_name}')
    print_cpp(delimiter)
    print_cpp()
    print_cpp(f'#include "model_{model_id:03d}.h"')
    print_cpp()

    usable_value_count = 0

    for value in values:
        name = value['name']
        field_type = value['field_type']
        scale_factor = value['scale_factor']
        value_id_mapping = value['value_id_mapping']
        mandatory = value['mandatory']

        if not value_id_mapping:
            continue

        usable_value_count += 1

        get_fn_name =  f"get_model_{model_id:03d}_{name}"
        value['get_fn_name'] = get_fn_name

        ######## Get value function ########

        print_cpp(f"static float {get_fn_name}(const void *register_data, uint32_t quirks, bool detection)")
        print_cpp(r"{")
        print_cpp(f"    const struct {struct_name} *model = static_cast<const struct {struct_name} *>(register_data);")

        # Retrieve value from struct
        if field_type == "int16":
            print_cpp(f"    int16_t val = model->{name};")
        elif field_type == "uint16":
            print_cpp(f"    uint16_t val = model->{name};")
        elif field_type == "uint32" or field_type == "acc32":
            print_cpp(f"    uint32_t val = convert_me_uint32(model->{name});")
        elif field_type == "float32":
            print_cpp(f"    float val = convert_me_float(model->{name});")
        else:
            print(f"Unhandled field_type {field_type} for field {name}", file=sys.stderr)

        # Special handling for "not accumulated" acc32 values
        if field_type == "acc32" and not mandatory:
            print_cpp(r"    if (val == 0 && !detection) return NAN;")

        # Check for non-implemented value
        if field_type == "int16":
            print_cpp(r"    if (val == INT16_MIN) return NAN;")
        elif field_type == "uint16":
            print_cpp(r"    if (val == UINT16_MAX) return NAN;")
        elif field_type == "uint32":
            print_cpp(r"    if (val == UINT32_MAX) return NAN;")
        elif field_type == "acc32":
            print_cpp(r"    uint32_t not_implemented_val = (quirks & SUN_SPEC_QUIRKS_ACC32_IS_INT32) == 0 ? UINT32_MAX : 0x80000000u;")
            print_cpp(r"    if (val == not_implemented_val) return NAN;")
        elif field_type == "float32":
            pass # isnan(val)) -> NAN is redundant
        else:
            print(f"Unhandled field_type {field_type} for field {name}", file=sys.stderr)

        # Handle int acc32 quirk
        if field_type == "acc32":
            print_cpp(r"    if (val > INT32_MAX && quirks & SUN_SPEC_QUIRKS_ACC32_IS_INT32) val = -val;")

        # Convert value to float
        if field_type == "float32":
            print_cpp(f"    float fval = val;")
        else:
            print_cpp(f"    float fval = static_cast<float>(val);")

        # Apply dynamic and/or static scale factor
        if scale_factor:
            if field_type in ["int16", "uint16", "int32", "uint32", "int64", "uint64", "acc32"]:
                scale_factor = f"get_scale_factor(model->{scale_factor})"
            else:
                print(f"Unexpected scale factor '{scale_factor}' for field '{name}'")
                exit(1)

        value_mapping_factor = value_id_mapping[1]
        if scale_factor and value_mapping_factor:
            print_cpp(f"    fval *= ({scale_factor} * {value_mapping_factor}f);")
        elif scale_factor:
            print_cpp(f"    fval *= {scale_factor};")
        elif value_mapping_factor:
            print_cpp(f"    fval *= {value_mapping_factor}f;")

        print_cpp(r"    return fval;")
        print_cpp(r"}")
        print_cpp()

    ######## Model struct ########

    model_data_name = f"model_{model_id:03d}_data"
    validator_fn_name = f"model_{model_id:03d}_validator"
    model['model_data_name'] = model_data_name
    model['validator_fn_name'] = validator_fn_name
    model['usable_value_count'] = usable_value_count

    read_twice = False
    for value in values:
        field_type = value['field_type']
        if field_type == "sunssf":
            read_twice = True
            break

    print_cpp(f"static bool {validator_fn_name}(const uint16_t * const register_data[2])")
    print_cpp(r"{")
    print_cpp(f"    const {struct_name} *block0 = reinterpret_cast<const {struct_name} *>(register_data[0]);")
    if read_twice:
        print_cpp(f"    const {struct_name} *block1 = reinterpret_cast<const {struct_name} *>(register_data[1]);")
    print_cpp(f"    if (block0->ID != {model_id:3d}) return false;")
    if read_twice:
        print_cpp(f"    if (block1->ID != {model_id:3d}) return false;")
    print_cpp(f"    if (block0->L  != {model_length:3d}) return false;")
    if read_twice:
        print_cpp(f"    if (block1->L  != {model_length:3d}) return false;")

    for value in values:
        name = value['name']
        field_type = value['field_type']
        if field_type != "sunssf":
            continue
        print_cpp(f"    if (block0->{name} != block1->{name}) return false;")

    print_cpp(r"    return true;")
    print_cpp(r"}")
    print_cpp()

    is_meter = model_id >= 200 and model_id < 300

    print_cpp(f"static const MetersSunSpecParser::ModelData {model_data_name} = {{")
    print_cpp(f"    {model_id}, // model_id")
    print_cpp(f"    {str(is_meter).lower()}, // is_meter")
    print_cpp(f"    {str(read_twice).lower()}, // read_twice")
    print_cpp(f"    &{validator_fn_name},")
    print_cpp(f"    {usable_value_count},  // value_count")
    print_cpp(r"    {    // value_data")

    for value in values:
        value_id_mapping = value['value_id_mapping']

        if not value_id_mapping:
            continue

        value_id = value_id_mapping[0]

        print_cpp(f"        {{ &{value['get_fn_name']}, MeterValueID::{value_id} }},")

    print_cpp(r"    }")
    print_cpp(r"};")
    print_cpp()

print_cpp()
print_cpp(r"const MetersSunSpecParser::AllModelData meters_sun_spec_all_model_data {")
print_cpp(f"    {len(models)}, // model_count")
print_cpp(r"    { // model_data")

for model in models:
    print_cpp(f"        &{model['model_data_name']},")

print_cpp(r"    }")
print_cpp(r"};")

cpp_output.seek(0)
with open(f"model_parser_gen.cpp", "w") as outfile:
    shutil.copyfileobj(cpp_output, outfile)