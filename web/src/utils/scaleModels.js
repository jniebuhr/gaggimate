// Advertised BLE name prefix → friendly model name; mirrors the esp-arduino-ble-scales matchers.
const SCALE_MODELS = [
  [/^BOOKOO[_-]SC[_-]M/i, 'Bookoo Themis Mini'],
  [/^BOOKOO[_-]SC[_-]U/i, 'Bookoo Themis Ultra'],
  [/^BOOKOO[_-]SC/i, 'Bookoo Themis'],
  [/^PEARLS/, 'Acaia Pearl S'],
  [/^PEARL/, 'Acaia Pearl'],
  [/^PYXIS/, 'Acaia Pyxis'],
  [/^LUNAR/, 'Acaia Lunar'],
  [/^(ACAIA|PROCH|UMBRA)/, 'Acaia'],
  [/^Decent Scale/, 'Decent Scale'],
  [/^EspressiScale/, 'EspressiScale'],
  [/^(Microbalance|Mb)/, 'DiFluid Microbalance'],
  [/^ECLAIR-/, 'Eclair'],
  [/^CFS-9002/, 'Eureka Precisa'],
  [/^LSJ-001/, 'Eureka Precisa'],
  [/^FELICITA/, 'Felicita'],
  [/^TIMEMORE_Dot|tes017/i, 'Timemore Dot'],
  [/basic ?3|timemore.*basic/i, 'Timemore Basic 3.0'],
  [/^Timemore Scale/, 'Timemore Black Mirror'],
  [/^AKU MINI SCALE/, 'Varia AKU Mini'],
  [/^(VARIA AKU|AKU SCALE)/i, 'Varia AKU'],
  [/^WeighMyBru/, 'WeighMyBru'],
  [/^blackcoffee/, 'Blackcoffee.io'],
  [/^my_scale/i, 'MyScale'],
];

export function scaleModelName(bleName) {
  if (!bleName) return null;
  const match = SCALE_MODELS.find(([pattern]) => pattern.test(bleName));
  return match ? match[1] : null;
}
