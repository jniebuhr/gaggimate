#!/usr/bin/env python3
"""Create and sign release manifests for the update server.

    sign_release.py keygen --private-key release-signing-key.pem --public-key release-signing-key.pub.pem
    sign_release.py sign --private-key release-signing-key.pem \\
        --channel stable --version 1.2.3 --target controller firmware.bin bootloader.bin
    sign_release.py info --public-key release-signing-key.pub.pem

"sign" writes manifest.json and manifest.sig, which are uploaded together with the files
(scripts/upload_release.sh --manifest-file manifest.json --signature-file manifest.sig).
In CI, pass the key through a secret instead of a file: --private-key-env RELEASE_SIGNING_KEY

The private key is the root of trust for every device: generate and keep it away from the update server.
Requires the "cryptography" package.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

MANIFEST_SCHEMA = 1


def raw_public_key(public_key: Ed25519PublicKey) -> bytes:
    return public_key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def describe_public_key(public_key: Ed25519PublicKey) -> str:
    raw = raw_public_key(public_key)
    c_array = ", ".join(f"0x{byte:02x}" for byte in raw)
    return (
        f"key id:     {hashlib.sha256(raw).hexdigest()[:16]}\n"
        f"public key: {raw.hex()}\n"
        f"firmware:   static const uint8_t RELEASE_SIGNING_KEY[32] = {{{c_array}}};"
    )


def load_private_key(args: argparse.Namespace) -> Ed25519PrivateKey:
    if args.private_key_env:
        source = f"${args.private_key_env}"
        pem = os.environ.get(args.private_key_env, "").encode()
        if not pem.strip():
            sys.exit(f"{source} is empty or not set")
    else:
        source = str(args.private_key)
        pem = args.private_key.read_bytes()
    try:
        key = serialization.load_pem_private_key(pem, password=None)
    except (ValueError, TypeError):
        sys.exit(f"{source} does not contain a PEM private key")
    if not isinstance(key, Ed25519PrivateKey):
        sys.exit(f"{source} is not an Ed25519 private key")
    return key


def cmd_keygen(args: argparse.Namespace) -> None:
    for path in (args.private_key, args.public_key):
        if path.exists():
            sys.exit(f"Refusing to overwrite {path}")

    key = Ed25519PrivateKey.generate()
    private_pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    )
    public_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    descriptor = os.open(args.private_key, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(private_pem)
    args.public_key.write_bytes(public_pem)

    print(f"private key file: {args.private_key} (keep offline; never put it on the update server)")
    print(f"public key file:  {args.public_key} (SIGNING_PUBLIC_KEY_FILE on the server)")
    print(describe_public_key(key.public_key()))


def cmd_info(args: argparse.Namespace) -> None:
    key = serialization.load_pem_public_key(args.public_key.read_bytes())
    if not isinstance(key, Ed25519PublicKey):
        sys.exit(f"{args.public_key} is not an Ed25519 public key")
    print(describe_public_key(key))


def cmd_sign(args: argparse.Namespace) -> None:
    key = load_private_key(args)

    files = []
    seen: set[str] = set()
    for path in args.files:
        if path.name in seen:
            sys.exit(f"Duplicate file name: {path.name}")
        seen.add(path.name)
        digest = hashlib.sha256()
        size = 0
        with open(path, "rb") as handle:
            while chunk := handle.read(1024 * 1024):
                digest.update(chunk)
                size += len(chunk)
        files.append({"name": path.name, "size": size, "sha256": digest.hexdigest()})

    document = {
        "schema": MANIFEST_SCHEMA,
        "channel": args.channel,
        "version": args.version,
        "target": args.target,
        "files": files,
    }
    if args.component_version:
        document["componentVersion"] = args.component_version

    # The signature covers these exact bytes; they are uploaded, stored and served unchanged.
    manifest = json.dumps(document, sort_keys=True, separators=(",", ":")).encode("ascii")
    signature = base64.b64encode(key.sign(manifest))

    args.manifest_out.write_bytes(manifest)
    args.signature_out.write_bytes(signature)
    print(f"Wrote {args.manifest_out} and {args.signature_out} for {args.channel}/{args.version}/{args.target}")
    print(describe_public_key(key.public_key()).splitlines()[0])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)

    keygen = commands.add_parser("keygen", help="generate a new Ed25519 release signing key pair")
    keygen.add_argument("--private-key", type=Path, required=True)
    keygen.add_argument("--public-key", type=Path, required=True)
    keygen.set_defaults(run=cmd_keygen)

    info = commands.add_parser("info", help="print key id and firmware constant for a public key")
    info.add_argument("--public-key", type=Path, required=True)
    info.set_defaults(run=cmd_info)

    sign = commands.add_parser("sign", help="write and sign the manifest for one channel/version/target")
    key_source = sign.add_mutually_exclusive_group(required=True)
    key_source.add_argument("--private-key", type=Path, help="PEM file with the private key")
    key_source.add_argument("--private-key-env", metavar="NAME", help="environment variable holding the PEM private key")
    sign.add_argument("--channel", required=True)
    sign.add_argument("--version", required=True)
    sign.add_argument("--target", required=True)
    sign.add_argument("--component-version")
    sign.add_argument("--manifest-out", type=Path, default=Path("manifest.json"))
    sign.add_argument("--signature-out", type=Path, default=Path("manifest.sig"))
    sign.add_argument("files", type=Path, nargs="+", help="every file that will be uploaded for this target")
    sign.set_defaults(run=cmd_sign)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
