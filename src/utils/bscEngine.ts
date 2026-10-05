import { DatabaseSnapshot, ScientistBscScore } from '../types/kmfri.ts';

export function calculateScientistBscScore(
  scientistId: string,
  db: DatabaseSnapshot
): ScientistBscScore | null {
  const user = db.users.find((u) => u.id === scientistId);
  if (!user) return null;

  const dir = db.directorates.find((d) => d.id === user.directorate_id);
  const dirName = dir ? dir.name : 'General Research';

  // 1. Projects Led & Participated
  const projectsLed = db.projects.filter((p) => p.principal_investigator_id === user.id);
  const memberProjectIds = new Set(
    db.project_members.filter((pm) => pm.user_id === user.id).map((pm) => pm.project_id)
  );
  const projectsLedIds = new Set(projectsLed.map((p) => p.id));
  const allProjectIds = new Set([...projectsLedIds, ...memberProjectIds]);

  // 2. Milestones
  const userMilestones = db.project_milestones.filter(
    (m) => m.owner_id === user.id || allProjectIds.has(m.project_id)
  );
  const completedMilestones = userMilestones.filter(
    (m) => m.status === 'Completed' || m.progress_percent === 100
  );
  const pendingMilestones = userMilestones.filter(
    (m) => m.status !== 'Completed' && m.progress_percent < 100
  );

  // 3. Research Outputs (Publications, Datasets, Presentations)
  const userOutputs = db.research_outputs.filter(
    (o) =>
      o.lead_scientist_id === user.id ||
      db.output_authors.some((oa) => oa.output_id === o.id && oa.user_id === user.id)
  );
  const publications = userOutputs.filter((o) => o.output_type === 'Publication');
  const datasets = userOutputs.filter((o) => o.output_type === 'Dataset');

  // 4. Reports (Approved vs Pending)
  const userReports = db.reports.filter((r) => r.scientist_id === user.id);
  const approvedReports = userReports.filter((r) => r.status === 'Approved');
  const pendingReports = userReports.filter((r) => r.status !== 'Approved');

  // 5. Activities (Field expeditions, lab sessions, community workshops)
  const userActivities = db.research_activities.filter(
    (a) => a.scientist_id === user.id || allProjectIds.has(a.project_id)
  );

  // 6. Funding / Grants
  const userGrants = db.funding.filter((f) => allProjectIds.has(f.project_id));
  const totalFundingSecured = userGrants.reduce((sum, g) => sum + (g.amount || 0), 0);

  // 7. Collaborators
  const userCollaboratorIds = new Set(
    db.project_collaborators
      .filter((pc) => allProjectIds.has(pc.project_id))
      .map((pc) => pc.collaborator_id)
  );

  // --- PERSPECTIVE 1: Scientific Excellence (Max 40 pts) ---
  const pubPoints = Math.min(20, publications.length * 8 + (publications.length === 0 ? 4 : 0));
  const dataPoints = Math.min(8, datasets.length * 4 + 2);
  const milestonePoints = Math.min(12, completedMilestones.length * 3 + (completedMilestones.length === 0 ? 3 : 0));
  const p1Score = Math.min(40, pubPoints + dataPoints + milestonePoints);
  const p1Details = [
    `${publications.length} peer-reviewed scientific publications (${pubPoints}/20 pts)`,
    `${datasets.length} marine & hydrographic datasets deposited (${dataPoints}/8 pts)`,
    `${completedMilestones.length} project milestones completed on schedule (${milestonePoints}/12 pts)`,
  ];

  // --- PERSPECTIVE 2: Policy & Blue Economy Stakeholder Impact (Max 25 pts) ---
  const reportPoints = Math.min(15, approvedReports.length * 5 + (approvedReports.length === 0 ? 5 : 0));
  const activityPoints = Math.min(10, userActivities.length * 2.5 + (userActivities.length === 0 ? 3 : 0));
  const p2Score = Math.min(25, reportPoints + activityPoints);
  const p2Details = [
    `${approvedReports.length} statutory technical & audit reports approved (${reportPoints}/15 pts)`,
    `${userActivities.length} field cruises, lab analyses & stakeholder workshops conducted (${activityPoints}/10 pts)`,
  ];

  // --- PERSPECTIVE 3: Grant Stewardship & Project Delivery (Max 20 pts) ---
  const piPoints = projectsLed.length > 0 ? 10 : 5;
  const projectPoints = Math.min(6, allProjectIds.size * 2);
  const fundingPoints = Math.min(4, Math.floor(totalFundingSecured / 2000000) + 2);
  const p3Score = Math.min(20, piPoints + projectPoints + fundingPoints);
  const p3Details = [
    `${projectsLed.length} projects as Principal Investigator (${piPoints}/10 pts)`,
    `${allProjectIds.size} total active research portfolios (${projectPoints}/6 pts)`,
    `Grant stewardship of KES ${totalFundingSecured.toLocaleString()} (${fundingPoints}/4 pts)`,
  ];

  // --- PERSPECTIVE 4: Institutional Capacity & Collaboration (Max 15 pts) ---
  const collabPoints = Math.min(8, userCollaboratorIds.size * 2.5 + 3);
  const teamPoints = Math.min(7, (memberProjectIds.size + 1) * 2.5);
  const p4Score = Math.min(15, collabPoints + teamPoints);
  const p4Details = [
    `${userCollaboratorIds.size} regional & international partner institutions engaged (${collabPoints}/8 pts)`,
    `${memberProjectIds.size} inter-disciplinary research team appointments (${teamPoints}/7 pts)`,
  ];

  // Total calculation (0 - 100)
  const totalScore = Math.round((p1Score + p2Score + p3Score + p4Score) * 10) / 10;

  // Grade mapping
  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'B';
  let gradeLabel = 'Satisfactory Progress';

  if (totalScore >= 90) {
    grade = 'A+';
    gradeLabel = 'Exceptional Marine Science Leadership';
  } else if (totalScore >= 80) {
    grade = 'A';
    gradeLabel = 'Commendable Scientific Achievement';
  } else if (totalScore >= 70) {
    grade = 'B';
    gradeLabel = 'Satisfactory Institutional Performance';
  } else if (totalScore >= 60) {
    grade = 'C';
    gradeLabel = 'Fair — Improvement Plan Recommended';
  } else {
    grade = 'D';
    gradeLabel = 'Needs Intensive Performance Realignment';
  }

  return {
    scientist_id: user.id,
    scientist_name: user.full_name,
    staff_number: user.staff_number,
    title: user.title,
    position: user.position,
    directorate_name: dirName,
    avatar_url: user.avatar_url,
    total_score: totalScore,
    grade,
    grade_label: gradeLabel,
    rank: 1, // Will be computed in bulk calculation
    perspectives: {
      scientific_excellence: {
        score: p1Score,
        max: 40,
        percent: Math.round((p1Score / 40) * 100),
        details: p1Details,
      },
      policy_stakeholder_impact: {
        score: p2Score,
        max: 25,
        percent: Math.round((p2Score / 25) * 100),
        details: p2Details,
      },
      grant_stewardship: {
        score: p3Score,
        max: 20,
        percent: Math.round((p3Score / 20) * 100),
        details: p3Details,
      },
      capacity_collaboration: {
        score: p4Score,
        max: 15,
        percent: Math.round((p4Score / 15) * 100),
        details: p4Details,
      },
    },
    metrics: {
      projects_led: projectsLed.length,
      projects_participated: memberProjectIds.size,
      milestones_completed: completedMilestones.length,
      milestones_pending: pendingMilestones.length,
      reports_approved: approvedReports.length,
      reports_pending: pendingReports.length,
      publications_count: publications.length,
      datasets_count: datasets.length,
      activities_count: userActivities.length,
      funding_secured: totalFundingSecured,
      collaborators_linked: userCollaboratorIds.size,
    },
  };
}

export function getAllScientistsBscScores(db: DatabaseSnapshot): ScientistBscScore[] {
  const scores: ScientistBscScore[] = [];

  for (const user of db.users) {
    const score = calculateScientistBscScore(user.id, db);
    if (score) {
      scores.push(score);
    }
  }

  // Sort descending by total score
  scores.sort((a, b) => b.total_score - a.total_score);

  // Assign ranks
  scores.forEach((s, idx) => {
    s.rank = idx + 1;
  });

  return scores;
}
