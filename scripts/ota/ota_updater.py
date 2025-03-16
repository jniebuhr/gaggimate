from __future__ import print_function
import os
import asyncio
import sys
import re
from time import sleep

from bleak import BleakClient, BleakScanner
# from bleak.exc import BleakError

header = """#####################################################################
    ------------------------BLE OTA update---------------------
    Arduino code @ https://github.com/fbiego/ESP32_BLE_OTA_Arduino
#####################################################################"""

UART_SERVICE_UUID = "fe590001-54ae-4a28-9f74-dfccb248601d"
UART_RX_CHAR_UUID = "fe590002-54ae-4a28-9f74-dfccb248601d"
UART_TX_CHAR_UUID = "fe590003-54ae-4a28-9f74-dfccb248601d"

PART = 19000
MTU = 250

ble_ota_dfu_end = False


async def start_ota(ble_address: str, filename: str):
    device = await BleakScanner.find_device_by_address(ble_address, timeout=20.0)
    disconnected_event = asyncio.Event()
    total = 0
    file_content = None
    client = None

    def handle_disconnect(_: BleakClient):
        print("Device disconnected !")
        disconnected_event.set()
        sleep(1)
        # sys.exit(0)

    async def handle_rx(_: int, data: bytearray):
        # print(f'\nReceived: {data = }\n')
        match data[0]:
            case 0xAA:
                print("Starting transfer, mode:", data[1])
                print_progress_bar(0, total, prefix='Upload progress:',
                                   suffix='Complete', length=50)

                match data[1]:
                    case 0:  # Slow mode
                        # Send first part
                        await send_part(0, file_content, client)
                    case 1:  # Fast mode
                        for index in range(file_parts):
                            await send_part(index, file_content, client)
                            print_progress_bar(index + 1, total,
                                               prefix='Upload progress:',
                                               suffix='Complete', length=50)

            case 0xF1:  # Send next part and update progress bar
                next_part_to_send = int.from_bytes(
                    data[2:3], byteorder='little')
                # print("Next part:", next_part_to_send, "\n")
                await send_part(next_part_to_send, file_content, client)
                print_progress_bar(next_part_to_send + 1, total,
                                   prefix='Upload progress:',
                                   suffix='Complete', length=50)

            case 0xF2:  # Install firmware
                # ins = 'Installing firmware'
                # print("Installing firmware")
                pass

            case 0x0F:
                print("OTA result: ", str(data[1:], 'utf-8'))
                global ble_ota_dfu_end
                ble_ota_dfu_end = True

    def print_progress_bar(iteration: int, total: int, prefix: str = '', suffix: str = '', decimals: int = 1, length: int = 100, filler: str = '█', print_end: str = "\r"):
        """
        Call in a loop to create terminal progress bar
        @params:
            iteration   - Required  : current iteration (Int)
            total       - Required  : total iterations (Int)
            prefix      - Optional  : prefix string (Str)
            suffix      - Optional  : suffix string (Str)
            decimals    - Optional  : positive number of decimals in percent complete (Int)
            length      - Optional  : character length of bar (Int)
            filler      - Optional  : bar fill character (Str)
            print_end   - Optional  : end character (e.g. "\r", "\r\n") (Str)
        """
        percent = ("{0:." + str(decimals) + "f}").format(100 *
                                                         (iteration / float(total)))
        filled_length = (length * iteration) // total
        bar = filler * filled_length + '-' * (length - filled_length)
        print(f'\r{prefix} |{bar}| {percent} % {suffix}', end=print_end)
        # Print new line upon complete
        if iteration == total:
            print()

    async def send_part(position: int, data: bytearray, client: BleakClient):
        start = position * PART
        end = (position + 1) * PART
        # print(locals())
        if len(data) < end:
            end = len(data)

        data_length = end - start
        parts = data_length // MTU
        for part_index in range(parts):
            to_be_sent = bytearray([0xFB, part_index])
            for mtu_index in range(MTU):
                to_be_sent.append(
                    data[(position*PART)+(MTU * part_index) + mtu_index])
            await send_data(client, to_be_sent)

        if data_length % MTU:
            remaining = data_length % MTU
            to_be_sent = bytearray([0xFB, parts])
            for index in range(remaining):
                to_be_sent.append(
                    data[(position*PART)+(MTU * parts) + index])
            await send_data(client, to_be_sent)

        await send_data(client, bytearray([0xFC, data_length//256, data_length %
                                           256, position//256, position % 256]), True)

    async def send_data(client: BleakClient, data: bytearray, response: bool = False):
        # print(f'{locals()["data"]}')
        await client.write_gatt_char(UART_RX_CHAR_UUID, data, response)

    if not device:
        print("-----------Failed--------------")
        print(f"Device with address {ble_address} could not be found.")
        return
        #raise BleakError(f"A device with address {ble_address} could not be found.")

    async with BleakClient(device, disconnected_callback=handle_disconnect) as local_client:
        client = local_client

        # Load file
        print("Reading from: ", filename)
        file_content = open(filename, "rb").read()
        file_parts = -(len(file_content) // -PART)
        total = file_parts
        file_length = len(file_content)
        print(f'File size: {len(file_content)}')

        # Set the UUID of the service you want to connect to and the callback
        await client.start_notify(UART_TX_CHAR_UUID, handle_rx)
        await asyncio.sleep(1.0)

        # Send file length
        await send_data(client, bytearray([0xFE,
                                           file_length >> 24 & 0xFF,
                                           file_length >> 16 & 0xFF,
                                           file_length >> 8 & 0xFF,
                                           file_length & 0xFF]))

        # Send number of parts and MTU value
        await send_data(client, bytearray([0xFF,
                                           file_parts//256,
                                           file_parts % 256,
                                           MTU // 256,
                                           MTU % 256]))

        # Remove previous update and receive transfer mode (start the update)
        await send_data(client, bytearray([0xFD]))

        # Wait til the update is complete
        while not ble_ota_dfu_end:
            await asyncio.sleep(1.0)

        print("Waiting for disconnect... ", end="")

        await disconnected_event.wait()
        print("-----------Complete--------------")


def is_valid_address(value: str = None) -> bool:
    # Regex to check valid MAC address
    regex_0 = (r"^([0-9A-Fa-f]{2}[:-])"
               r"{5}([0-9A-Fa-f]{2})|"
               r"([0-9a-fA-F]{4}\\."
               r"[0-9a-fA-F]{4}\\."
               r"[0-9a-fA-F]{4}){17}$")
    regex_1 = (r"^[{]?[0-9a-fA-F]{8}"
               r"-([0-9a-fA-F]{4}-)"
               r"{3}[0-9a-fA-F]{12}[}]?$")

    # Compile the ReGex
    regex_0 = re.compile(regex_0)
    regex_1 = re.compile(regex_1)

    # If the string is empty return false
    if value is None:
        return False

    # Return if the string matched the ReGex
    if re.search(regex_0, value) and len(value) == 17:
        return True

    return re.search(regex_1, value) and len(value) == 36


if __name__ == "__main__":
    print(header)
    # Check if the user has entered enough arguments
    # sys.argv.append("C8:C9:A3:D2:60:8E")
    # sys.argv.append("firmware.bin")

    if len(sys.argv) < 3:
        print("Specify the device address and firmware file")
        import sys
        import os
        filename = os.path.join(os.path.dirname(
            __file__), '.pio', 'build', 'esp32doit-devkit-v1', 'firmware.bin')
        filename = filename if os.path.exists(filename) else "firmware.bin"
        print(
            f"$ {sys.executable} \"{__file__}\" \"C8:C9:A3:D2:60:8E\" \"{filename}\"")
        exit(1)

    print("Trying to start OTA update")
    ble_address = sys.argv[1]
    filename = sys.argv[2]

    # Check if the address is valid
    if not is_valid_address(ble_address):
        print(f"Invalid Address: {ble_address}")
        exit(2)

    # Check if the file exists
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        exit(3)

    try:
        # Start the OTA update
        asyncio.run(start_ota(ble_address, filename))
    except KeyboardInterrupt:
        print("\nExiting...")
        exit(0)
    except OSError:
        print("\nExiting (OSError)...")
        exit(1)
    except Exception:
        import traceback
        traceback.print_exc()
        exit(2)
