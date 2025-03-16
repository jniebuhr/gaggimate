import asyncio
from bleak import BleakScanner


async def run():
    for device in await BleakScanner.discover():
        print(f'{device.name} - {device.address}')

if __name__ == '__main__':
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
