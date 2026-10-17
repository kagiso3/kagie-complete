(function (root) {
  'use strict';

  const data = typeof module !== 'undefined' && module.exports ? require('./recommendation-data.js') : root.KagieRecommendationData;
  const key = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const level = mark => mark >= 80 ? 7 : mark >= 70 ? 6 : mark >= 60 ? 5 : mark >= 50 ? 4 : mark >= 40 ? 3 : mark >= 30 ? 2 : 1;
  function readMarks(profile) {
    const seen = new Set();
    return (Array.isArray(profile?.marks) ? profile.marks : []).flatMap(row => {
      if (!row || typeof row !== 'object') {
        return [];
      }
      const name = String(row.subject || row.name || '').trim();
      const raw = row.percent ?? row.mark ?? row.percentage;
      const mark = raw == null || String(raw).trim() === '' ? '' : Number(raw);
      if (!name || seen.has(key(name)) || mark !== '' && (!Number.isFinite(mark) || mark < 0 || mark > 100)) {
        return [];
      }
      seen.add(key(name));
      return [{
        name,
        mark
      }];
    });
  }
  function validate(rows) {
    if (!rows.length) {
      return 'Add at least one subject and its percentage.';
    }
    const seen = new Set();
    for (const row of rows) {
      if (!key(row.name)) {
        return 'Choose a subject for every row.';
      }
      if (seen.has(key(row.name))) {
        return 'Each subject can only be added once.';
      }
      seen.add(key(row.name));
      if (row.mark === '' || row.mark == null || !Number.isFinite(Number(row.mark)) || Number(row.mark) < 0 || Number(row.mark) > 100) {
        return 'Enter a percentage from 0 to 100 for every subject.';
      }
    }
    return '';
  }
  function academic(rows) {
    const valid = rows.filter(row => row.mark !== '' && row.mark != null && Number.isFinite(Number(row.mark)) && Number(row.mark) >= 0 && Number(row.mark) <= 100);
    const counted = valid.filter(row => key(row.name) !== 'life orientation').slice().sort((a, b) => Number(b.mark) - Number(a.mark)).slice(0, 6);
    return {
      aps: counted.reduce((sum, row) => sum + level(Number(row.mark)), 0),
      average: valid.length ? Math.round(valid.reduce((sum, row) => sum + Number(row.mark), 0) / valid.length) : 0,
      count: valid.length,
      counted,
      strengths: valid.filter(row => Number(row.mark) >= 60).slice().sort((a, b) => Number(b.mark) - Number(a.mark))
    };
  }
  function findSubject(rows, name) {
    const required = key(name);
    return rows.filter(row => required === 'english' ? /^english(?:$| )/.test(key(row.name)) : key(row.name) === required).sort((a, b) => Number(b.mark) - Number(a.mark))[0];
  }
  function recommend(rows, interests) {
    if (!academic(rows).count || validate(rows)) {
      return [];
    }
    const summary = academic(rows);
    return data.courses.map(course => {
      let score = 0;
      let eligible = summary.aps >= course.minAps;
      const reasons = [eligible ? `APS guide met: ${summary.aps}/${course.minAps}` : `APS below this guide: ${summary.aps}/${course.minAps}`];
      if (eligible) {
        score += 28;
      }
      for (const requirement of course.requiredSubjects) {
        const found = findSubject(rows, requirement.name);
        const met = found && Number(found.mark) >= requirement.min;
        if (met) {
          score += 23;
        } else {
          eligible = false;
        }
        reasons.push(found ? `${requirement.name}: ${found.mark}% · guide ${requirement.min}%` : `${requirement.name} has not been added`);
      }
      for (const subject of course.recommendedSubjects) {
        const found = findSubject(rows, subject.name);
        if (found && Number(found.mark) >= subject.min) {
          score += 8;
          reasons.push(`${subject.name} strengthens this match`);
        }
      }
      const matchingFields = course.interestTags.filter(field => interests.includes(field));
      if (matchingFields.length) {
        score += 12;
        reasons.push(`Matches your interest in ${matchingFields.join(' and ')}`);
      }
      score += summary.average >= 65 ? 8 : summary.average >= 55 ? 4 : 0;
      score = Math.min(100, score);
      const match = eligible && score >= 70 ? 'High match' : eligible && score >= 54 ? 'Good match' : score >= 38 ? 'More options' : 'Low';
      return {
        ...course,
        score,
        match,
        eligible,
        reasons
      };
    }).filter(course => course.match !== 'Low').sort((a, b) => b.score - a.score || a.courseName.localeCompare(b.courseName));
  }
  const model = {
    key,
    level,
    readMarks,
    validate,
    academic,
    findSubject,
    recommend
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = model;
  } else {
    root.KagieRecommendationModel = model;
  }
})(typeof window !== 'undefined' ? window : globalThis);
