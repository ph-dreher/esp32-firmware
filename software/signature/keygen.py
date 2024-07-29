#!/usr/bin/python3 -u

import os
import sys
import ctypes
import ctypes.util
import argparse
import json
import subprocess
import configparser
import secrets
import getpass

directory = os.path.normpath(os.path.dirname(__file__))


def make_path(path):
    if os.path.isabs(path):
        return path

    return os.path.join('.', os.path.relpath(os.path.join(directory, path)))


def load_libsodium():
    libsodium_path = ctypes.util.find_library('sodium')

    if libsodium_path != None:
        libsodium = ctypes.cdll.LoadLibrary(libsodium_path)
    else:
        for extension in ['so', 'dll', 'dylib']:
            try:
                libsodium = ctypes.cdll.LoadLibrary(make_path(f'libsodium.{extension}'))
            except:
                continue

            break
        else:
            raise Exception('cannot find libsodium library')

    if libsodium.sodium_init() < 0:
        raise Exception('libsodium sodium_init failed')

    return libsodium


def keepassxc(config, prefix, action, args, entry, password=None, input=None):
    path = make_path(config[prefix + '_path'])
    protection = config[prefix + '_protection']
    full_args = ['keepassxc-cli', action]
    full_kwargs = {'stderr': subprocess.DEVNULL, 'encoding': 'utf-8'}
    full_input = None

    if protection == 'token':
        full_args += ['-q', '--no-password', '-y', f'2:{config[prefix + "_token"]}']
    elif protection == 'keyfile':
        full_args += ['-q', '--no-password', '-k', make_path(config[prefix + '_keyfile'])]
    elif protection == 'password':
        assert password != None
        full_input = password + '\n'
    else:
        raise Exception(f'invalid protection: {protection}')

    full_args += args + [path, entry]

    if input != None:
        if full_input != None:
            full_input += input
        else:
            full_input = input

    if full_input != None:
        full_kwargs['input'] = full_input

    try:
        return subprocess.check_output(full_args, **full_kwargs)
    except:
        return None


def main():
    libsodium = load_libsodium()

    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true')
    parser.add_argument('preset')

    args = parser.parse_args()

    config = configparser.ConfigParser()
    config.read(make_path('config.ini'))
    config = config['preset:' + args.preset]

    sodium_public_key_path = make_path(config['sodium_public_key_path'])

    print(f'checking for existing sodium public key file {sodium_public_key_path}')

    if os.path.exists(sodium_public_key_path):
        if not args.force:
            raise Exception(f'sodium public key file {sodium_public_key_path} already exists')

        print(f'removing existing sodium public key file {sodium_public_key_path} [--force]')

        try:
            os.remove(sodium_public_key_path)
        except Exception as e:
            raise Exception(f'could not remove existing sodium public key file {sodium_public_key_path}: {e}')

    sodium_secret_key_path = make_path(config['sodium_secret_key_path'])

    print(f'checking for existing sodium secret key entry in {sodium_secret_key_path}')

    if not os.path.exists(sodium_secret_key_path):
        raise Exception(f'sodium secret key file {sodium_secret_key_path} is missing')

    sodium_secret_key_password = None

    if config['sodium_secret_key_protection'] == 'password':
        print(f'enter password for existing sodium secret key file {sodium_secret_key_path}:')
        sodium_secret_key_password = getpass.getpass(prompt='')

    if keepassxc(config, 'sodium_secret_key', 'show', [], 'sodium_secret_key', password=sodium_secret_key_password) != None:
        if not args.force:
            raise Exception(f'sodium secret key entry already exists in {sodium_secret_key_path}')

        print(f'removing existing sodium secret key entry from {sodium_secret_key_path} [--force]')

        if keepassxc(config, 'sodium_secret_key', 'rm', [], 'sodium_secret_key', password=sodium_secret_key_password) == None:
            raise Exception(f'could not remove existing sodium secret key entry from {sodium_secret_key_path}')

        if keepassxc(config, 'sodium_secret_key', 'show', [], 'sodium_secret_key', password=sodium_secret_key_password) != None:
            print(f'removing existing sodium secret key entry from {sodium_secret_key_path} recycling bin [--force]')

            if keepassxc(config, 'sodium_secret_key', 'rm', [], 'sodium_secret_key', password=sodium_secret_key_password) == None:
                raise Exception(f'could not remove existing sodium secret key entry from {sodium_secret_key_path} recycling bin')

    print('generating sodium public and secret key')

    crypto_sign_PUBLICKEYBYTES = libsodium.crypto_sign_publickeybytes()
    crypto_sign_SECRETKEYBYTES = libsodium.crypto_sign_secretkeybytes()

    sodium_public_key_buffer = ctypes.create_string_buffer(crypto_sign_PUBLICKEYBYTES)
    sodium_secret_key_buffer = ctypes.create_string_buffer(crypto_sign_SECRETKEYBYTES)

    if libsodium.crypto_sign_keypair(sodium_public_key_buffer, sodium_secret_key_buffer) < 0:
        raise Exception('libsodium crypto_sign_keypair failed')

    print(f'writing sodium public key to {sodium_public_key_path}')

    sodium_public_key_json = json.dumps({'sodium_public_key': sodium_public_key_buffer.raw.hex()})

    try:
        with open(sodium_public_key_path + '.tmp', 'w', encoding='utf-8') as f:
            f.write(sodium_public_key_json + '\n')
    except Exception as e:
        raise Exception(f'could not write sodium public key to {sodium_public_key_path}.tmp: {e}')

    try:
        os.replace(sodium_public_key_path + '.tmp', sodium_public_key_path)
    except Exception as e:
        raise Exception(f'could not rename sodium public key file from {sodium_public_key_path}.tmp to {sodium_public_key_path}: {e}')

    print(f'adding sodium secret key entry to {sodium_secret_key_path}')

    if keepassxc(config, 'sodium_secret_key', 'add', ['-p'], 'sodium_secret_key', password=sodium_secret_key_password, input=sodium_secret_key_buffer.raw.hex()) == None:
        raise Exception(f'could not add sodium secret key to {sodium_secret_key_path}')

    gpg_keyring_path = make_path(config['gpg_keyring_path'])

    print(f'checking for existing GPG keyring file {gpg_keyring_path}')

    if os.path.exists(gpg_keyring_path):
        if not args.force:
            raise Exception(f'GPG keyring file {gpg_keyring_path} already exists')

        print(f'removing existing GPG keyring file {gpg_keyring_path} [--force]')

        try:
            os.remove(gpg_keyring_path)
        except Exception as e:
            raise Exception(f'could not remove existing GPG keyring file {gpg_keyring_path}: {e}')

    gpg_keyring_passphrase_path = make_path(config['gpg_keyring_passphrase_path'])

    if not os.path.exists(gpg_keyring_passphrase_path):
        raise Exception(f'GPG keyring passphrase file {gpg_keyring_passphrase_path} is missing')

    gpg_keyring_passphrase_password = None

    if config['gpg_keyring_passphrase_protection'] == 'password':
        print(f'enter password for existing GPG keyring passphrase file {gpg_keyring_passphrase_path}:')
        gpg_keyring_passphrase_password = getpass.getpass(prompt='')

    print(f'checking for existing GPG keyring passphrase enrty in {gpg_keyring_passphrase_path}')

    if keepassxc(config, 'gpg_keyring_passphrase', 'show', [], 'gpg_keyring_passphrase', password=gpg_keyring_passphrase_password) != None:
        if not args.force:
            raise Exception(f'GPG keyring passphrase entry already exists in {gpg_keyring_passphrase_path}')

        print(f'removing existing GPG keyring passphrase entry from {gpg_keyring_passphrase_path} [--force]')

        if keepassxc(config, 'gpg_keyring_passphrase', 'rm', [], 'gpg_keyring_passphrase', password=gpg_keyring_passphrase_password) == None:
            raise Exception(f'could not remove existing GPG keyring passphrase entry from {gpg_keyring_passphrase_path}')

        if keepassxc(config, 'gpg_keyring_passphrase', 'show', [], 'gpg_keyring_passphrase', password=gpg_keyring_passphrase_password) != None:
            print(f'removing existing GPG keyring passphrase entry from {gpg_keyring_passphrase_path} recycling bin [--force]')

            if keepassxc(config, 'gpg_keyring_passphrase', 'rm', [], 'gpg_keyring_passphrase', password=gpg_keyring_passphrase_password) == None:
                raise Exception(f'could not remove existing GPG keyring passphrase entry from {gpg_keyring_passphrase_path} recycling bin')

    gpg_public_key_path = make_path(config['gpg_public_key_path'])

    print(f'checking for existing GPG public key file {gpg_public_key_path}')

    if os.path.exists(gpg_public_key_path):
        if not args.force:
            raise Exception(f'GPG public key file {gpg_public_key_path} already exists')

        print(f'removing existing GPG public key file {gpg_public_key_path} [--force]')

        try:
            os.remove(gpg_public_key_path)
        except Exception as e:
            raise Exception(f'could not remove existing GPG public key file {gpg_public_key_path}: {e}')

    print(f'adding GPG keyring passphrase entry to {gpg_keyring_passphrase_path}')

    gpg_keyring_passphrase = secrets.token_hex(64)

    if keepassxc(config, 'gpg_keyring_passphrase', 'add', ['-p'], 'gpg_keyring_passphrase', password=gpg_keyring_passphrase_password, input=gpg_keyring_passphrase) == None:
        raise Exception(f'could not add GPG keyring passphrase to {gpg_keyring_passphrase_path}')

    print(f'creating GPG keyring file {gpg_keyring_path}')

    try:
        subprocess.check_call([
            'gpg',
            '--pinentry-mode', 'loopback',
            '--no-default-keyring',
            '--keyring', gpg_keyring_path,
            '--passphrase', gpg_keyring_passphrase,
            '--quick-generate-key', config['gpg_keyring_user_id'], 'default', 'default', '0',
        ])
    except:
        raise Exception(f'could not create GPG keyring file {gpg_keyring_path}')

    print(f'exporting GPG public key to {gpg_public_key_path}')

    try:
        subprocess.check_call([
            'gpg',
            '--pinentry-mode', 'loopback',
            '--no-default-keyring',
            '--keyring', gpg_keyring_path,
            '--passphrase', gpg_keyring_passphrase,
            '--output', gpg_public_key_path,
            '--export', config['gpg_keyring_user_id'],
        ])
    except:
        raise Exception(f'could not export GPG public key to {gpg_public_key_path}')

    print('successfully generated keys')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'error: {e}')
        sys.exit(1)
