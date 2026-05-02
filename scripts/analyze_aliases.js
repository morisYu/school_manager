const fs = require('fs');
const path = require('path');

const schedulesPath = path.join(__dirname, '..', 'json', 'schedules.json');
const schoolsPath = path.join(__dirname, '..', 'json', 'schools.json');

const schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf8'));
const schools = JSON.parse(fs.readFileSync(schoolsPath, 'utf8'));

const aliasesFromSchedules = new Set();
schedules.forEach(s => {
    const institution = s['기관명'] || '';
    const match = institution.match(/\(([^)]+)\)/);
    if (match) {
        aliasesFromSchedules.add(match[1].trim());
    }
});

console.log(`Found ${aliasesFromSchedules.size} unique aliases in schedules.`);

const schoolMapByAlias = new Map();
const schoolMapByName = new Map();

schools.forEach(s => {
    if (s['검색용 약칭']) schoolMapByAlias.set(s['검색용 약칭'].trim(), s);
    if (s['학교명']) schoolMapByName.set(s['학교명'].trim(), s);
});

const missingAliases = [];
const matchedResults = [];

aliasesFromSchedules.forEach(alias => {
    if (schoolMapByAlias.has(alias)) {
        matchedResults.push({ alias, status: 'MATCHED', schoolName: schoolMapByAlias.get(alias)['학교명'] });
    } else {
        // Try fuzzy match: see if any school name contains this alias or starts with it
        let bestMatch = null;
        for (const [name, school] of schoolMapByName) {
            if (name.includes(alias)) {
                bestMatch = school;
                break;
            }
        }
        
        if (bestMatch) {
            matchedResults.push({ alias, status: 'SUGGESTED', schoolName: bestMatch['학교명'] });
        } else {
            matchedResults.push({ alias, status: 'MISSING', schoolName: 'N/A' });
        }
    }
});

// Output results
console.log('\n--- Alias Matching Report ---');
console.table(matchedResults.sort((a, b) => a.status.localeCompare(b.status)));
