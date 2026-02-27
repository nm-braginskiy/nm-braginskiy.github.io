// Original content of simplifier.js

// Assuming the original content is here

function solve() {
    // Existing solve function logic
}

function groupSteps(steps, grouping = false) {
  if (!grouping) return steps;
  
  const grouped = [];
  let i = 0;
  
  while (i < steps.length) {
    const currentLaw = steps[i].law;
    
    if (i === 0 || !currentLaw) {
      grouped.push(steps[i]);
      i++;
      continue;
    }
    
    const lawGroup = [steps[i]];
    let j = i + 1;
    
    while (j < steps.length && steps[j].law === currentLaw) {
      lawGroup.push(steps[j]);
      j++;
    }
    
    if (lawGroup.length === 1) {
      grouped.push(lawGroup[0]);
    } else {
      grouped.push({
        expr: lawGroup[lawGroup.length - 1].expr,
        law: `${currentLaw} (×${lawGroup.length})`,
        count: lawGroup.length,
        substeps: lawGroup
      });
    }
    
    i = j;
  }
  
  return grouped;
}