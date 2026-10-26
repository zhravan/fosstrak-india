import { readdir, readFile } from 'node:fs/promises';

const directory = new URL('../data/contributions/', import.meta.url);
const required = ['commonName', 'homepage', 'startDate', 'endDate', 'selfDescription', 'presentationForm', 'sourceUrl'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const supportedFormats = new Set(['online', 'physical', 'hybrid']);
const validDate = (value) => {
  if (!datePattern.test(String(value || ''))) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validUrl = (value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

let names;
try { names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort(); }
catch (error) {
  if (error.code === 'ENOENT') {
    console.log('No data/contributions directory; nothing to validate.');
    process.exit(0);
  }
  throw error;
}
const errors = [];
const seen = new Set();
for (const name of names) {
  let record;
  try { record = JSON.parse(await readFile(new URL(name, directory), 'utf8')); }
  catch (error) { errors.push(`${name}: invalid JSON (${error.message})`); continue; }
  if (!record || Array.isArray(record) || typeof record !== 'object') {
    errors.push(`${name}: expected a JSON object`);
    continue;
  }
  for (const key of required) {
    if (typeof record[key] !== 'string' || !record[key].trim()) errors.push(`${name}: ${key} is required`);
  }
  for (const key of ['homepage', 'sourceUrl']) if (record[key] && !validUrl(record[key])) errors.push(`${name}: ${key} must be an HTTP(S) URL`);
  if (record.registrationLink && !validUrl(record.registrationLink)) errors.push(`${name}: registrationLink must be an HTTP(S) URL`);
  if (record.startDate && !validDate(record.startDate)) errors.push(`${name}: startDate must be a real YYYY-MM-DD date`);
  if (record.endDate && !validDate(record.endDate)) errors.push(`${name}: endDate must be a real YYYY-MM-DD date`);
  if (validDate(record.startDate) && validDate(record.endDate) && record.endDate < record.startDate) errors.push(`${name}: endDate must be on or after startDate`);
  if (record.presentationForm && !supportedFormats.has(record.presentationForm)) errors.push(`${name}: presentationForm must be online, physical, or hybrid`);
  const duplicateKey = `${String(record.commonName || '').trim().toLocaleLowerCase('en-IN')}|${record.startDate || ''}`;
  if (record.commonName && record.startDate && seen.has(duplicateKey)) errors.push(`${name}: duplicate event name and start date in this contribution batch`);
  seen.add(duplicateKey);
}
if (errors.length) {
  console.error('Event data validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Validated ${names.length} event contribution file(s).`);
