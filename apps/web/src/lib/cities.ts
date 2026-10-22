// The cities a club can pick for now (R1b): the Changemaker network's cities, each at its centre to 2 decimal places
// (07 §8: places are city-level only, never a school's address), with its country and time zone. A club from a
// city that isn't here asks the team, who add it.
export type City = { id: string; city: string; country: string; lat: number; lng: number; tz: string }
const c = (city: string, country: string, lat: number, lng: number, tz: string): City =>
  ({ id: `${city}-${country}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'), city, country, lat, lng, tz })
export const CITIES: City[] = [
  c('Basel', 'CH', 47.55, 7.59, 'Europe/Zurich'), c('Berlin', 'DE', 52.52, 13.41, 'Europe/Berlin'), c('Bonn', 'DE', 50.74, 7.1, 'Europe/Berlin'),
  c('Bratislava', 'SK', 48.14, 17.11, 'Europe/Bratislava'), c('Brussels', 'BE', 50.85, 4.35, 'Europe/Brussels'),
  c('Bucharest', 'RO', 44.43, 26.1, 'Europe/Bucharest'), c('Budapest', 'HU', 47.49, 19.05, 'Europe/Budapest'),
  c('Columbus', 'US', 39.96, -83, 'America/New_York'), c('Debrecen', 'HU', 47.53, 21.62, 'Europe/Budapest'),
  c('Düsseldorf', 'DE', 51.23, 6.78, 'Europe/Berlin'), c('Essen', 'DE', 51.45, 7.01, 'Europe/Berlin'), c('Frankfurt', 'DE', 50.11, 8.68, 'Europe/Berlin'),
  c('Gebze', 'TR', 40.8, 29.43, 'Europe/Istanbul'), c('Hamburg', 'DE', 53.55, 10, 'Europe/Berlin'), c('Kaunas', 'LT', 54.9, 23.89, 'Europe/Vilnius'),
  c('Kraków', 'PL', 50.06, 19.94, 'Europe/Warsaw'), c('Munich', 'DE', 48.14, 11.58, 'Europe/Berlin'), c('Neu-Ulm', 'DE', 48.38, 10, 'Europe/Berlin'),
  c('Prague', 'CZ', 50.09, 14.42, 'Europe/Prague'), c('Stuttgart', 'DE', 48.78, 9.18, 'Europe/Berlin'), c('The Hague', 'NL', 52.08, 4.31, 'Europe/Amsterdam'),
  c('Vienna', 'AT', 48.21, 16.37, 'Europe/Vienna'), c('Zagreb', 'HR', 45.81, 15.98, 'Europe/Zagreb'),
]
