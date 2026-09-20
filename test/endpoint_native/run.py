#!/usr/bin/env python3
"""Run after `pio run -e display` has generated the protobuf sources and installed dependencies."""
from pathlib import Path
import subprocess
import tempfile
root = Path(__file__).resolve().parents[2]
proto = root / '.pio/build/display/nanopb/generated-src'
nanopb = root / '.pio/libdeps/display/Nanopb'
with tempfile.TemporaryDirectory(prefix='gm-endpoint-') as tmp:
    binary = str(Path(tmp) / 'endpoint-tests')
    args = ['c++', '-std=c++17', '-pthread', '-g', '-fsanitize=address,undefined']
    for path in [root / 'test/endpoint_native/stubs', root / 'lib/NanoPbComm/src', proto, nanopb]:
        args += ['-I', str(path)]
    args += [str(root / 'test/endpoint_native/main.cpp'), str(root / 'lib/NanoPbComm/src/Endpoint.cpp'),
             str(proto / 'gaggimate.pb.c')]
    args += [str(nanopb / name) for name in ['pb_common.c', 'pb_encode.c', 'pb_decode.c']]
    subprocess.run(args + ['-o', binary], check=True)
    subprocess.run([binary], check=True)
