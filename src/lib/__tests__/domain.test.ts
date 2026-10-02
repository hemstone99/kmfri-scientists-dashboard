import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canManageUsers,
  canApproveProject,
  canEditProject,
  canReviewReport,
  isReportOverdue,
  daysUntilDate,
  calculateRemainingFunding,
  calculateUtilizationPercent,
  normalizeCurrencyToKES,
  validateUserInput,
  validateProjectInput,
  validateFundingInput,
  validateLocationInput,
  generateCSV,
  calculateScientistBalancedScorecard,
} from '../domain.ts';

describe('KMFRI RBAC & Permission Engine', () => {
  it('grants SUPER ADMIN universal access to all permissions', () => {
    expect(hasPermission('SUPER ADMIN', [], 'manage_system')).toBe(true);
    expect(hasPermission('SUPER ADMIN', [], 'manage_users')).toBe(true);
    expect(canManageUsers('SUPER ADMIN')).toBe(true);
  });

  it('enforces VIEWER read-only restrictions', () => {
    expect(hasPermission('VIEWER', undefined, 'view_analytics')).toBe(true);
    expect(hasPermission('VIEWER', undefined, 'export_data')).toBe(true);
    expect(hasPermission('VIEWER', undefined, 'manage_projects')).toBe(false);
    expect(canEditProject('user-1', 'VIEWER', 'user-1', ['user-1'])).toBe(false);
  });

  it('allows SCIENTIST/RESEARCHER to edit only assigned or led projects', () => {
    expect(
      canEditProject('sci-1', 'SCIENTIST/RESEARCHER', 'sci-1', [])
    ).toBe(true);
    expect(
      canEditProject('sci-2', 'SCIENTIST/RESEARCHER', 'sci-1', ['sci-2'])
    ).toBe(true);
    expect(
      canEditProject('sci-3', 'SCIENTIST/RESEARCHER', 'sci-1', ['sci-2'])
    ).toBe(false);
  });

  it('validates project approval and report review permissions for Directorate Heads and Directors', () => {
    expect(
      canApproveProject('DIRECTOR/OVERALL MANAGEMENT', undefined, 'OCS', 'FWS')
    ).toBe(true);
    expect(
      canApproveProject('HEAD OF OCEANS & COASTAL SYSTEMS', undefined, 'OCS', 'OCS')
    ).toBe(true);
    expect(canReviewReport('HEAD OF OCEANS & COASTAL SYSTEMS')).toBe(true);
    expect(canReviewReport('SCIENTIST/RESEARCHER')).toBe(false);
  });
});

describe('Report Deadline & Overdue Automation', () => {
  it('flags unapproved reports past due date as overdue', () => {
    expect(isReportOverdue('2026-05-01', 'Draft', '2026-09-29')).toBe(true);
    expect(isReportOverdue('2026-05-01', 'Submitted', '2026-09-29')).toBe(true);
    expect(isReportOverdue('2026-05-01', 'Approved', '2026-09-29')).toBe(false);
    expect(isReportOverdue('2026-12-31', 'Draft', '2026-09-29')).toBe(false);
  });

  it('calculates exact days until deadline', () => {
    expect(daysUntilDate('2026-10-09', '2026-09-29')).toBe(10);
    expect(daysUntilDate('2026-09-19', '2026-09-29')).toBe(-10);
  });
});

describe('Grant & Funding Calculations', () => {
  it('computes remaining funding balance and utilization percentage accurately', () => {
    expect(calculateRemainingFunding(500000, 175000)).toBe(325000);
    expect(calculateUtilizationPercent(500000, 175000)).toBe(35);
    expect(calculateUtilizationPercent(0, 100)).toBe(0);
  });

  it('normalizes multi-currency grants to KES equivalent', () => {
    expect(normalizeCurrencyToKES(1000, 'KES')).toBe(1000);
    expect(normalizeCurrencyToKES(100, 'USD')).toBe(12950);
  });
});

describe('Entity Integrity & Input Validation', () => {
  it('validates user email and full name constraints', () => {
    expect(
      validateUserInput({ fullName: 'Dr. Amina Juma', email: 'ajuma@kmfri.go.ke' }).valid
    ).toBe(true);
    expect(
      validateUserInput({ fullName: 'A', email: 'invalid-email' }).valid
    ).toBe(false);
  });

  it('validates project chronological dates and progress bounds', () => {
    expect(
      validateProjectInput({
        projectCode: 'KMFRI-OCS-2026-01',
        title: 'Kenyan EEZ Pelagic Stock Assessment',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        budget: 15000000,
        progressPercent: 45,
      }).valid
    ).toBe(true);

    expect(
      validateProjectInput({
        projectCode: 'KMFRI-OCS-2026-02',
        title: 'Invalid Date Project',
        startDate: '2026-12-31',
        endDate: '2026-01-01',
      }).valid
    ).toBe(false);
  });

  it('validates grant funding allocation bounds', () => {
    expect(
      validateFundingInput({
        grantNumber: 'WIOMSA-MASMA-2026-09',
        projectId: 'proj-1',
        funderId: 'funder-1',
        amount: 100000,
        allocatedAmount: 85000,
        spentAmount: 25000,
      }).valid
    ).toBe(true);

    expect(
      validateFundingInput({
        grantNumber: 'WIOMSA-MASMA-2026-09',
        projectId: 'proj-1',
        funderId: 'funder-1',
        amount: 50000,
        allocatedAmount: 85000,
        spentAmount: 25000,
      }).valid
    ).toBe(false);
  });

  it('validates GIS marine location coordinates', () => {
    expect(
      validateLocationInput({
        name: 'Tudor Creek Mangrove Station',
        county: 'Mombasa',
        site: 'Tudor Creek Channel',
        latitude: -4.0123,
        longitude: 39.6682,
        marineArea: 'Tudor Creek Estuarine System',
      }).valid
    ).toBe(true);

    expect(
      validateLocationInput({
        name: 'Invalid Coord Station',
        county: 'Mombasa',
        site: 'Reef',
        latitude: -125.0,
        longitude: 39.6682,
        marineArea: 'Reef',
      }).valid
    ).toBe(false);
  });
});

describe('CSV Export Formatter', () => {
  it('properly escapes commas and quotes in CSV output', () => {
    const csv = generateCSV(
      ['Project Code', 'Title', 'Budget'],
      [['KMFRI-01', 'Coral Reef, Seagrass & "Blue Carbon" Study', 4500000]]
    );
    expect(csv).toContain('"Coral Reef, Seagrass & ""Blue Carbon"" Study"');
  });
});

describe('Scientist Balanced Scorecard Engine', () => {
  it('computes 4-perspective Balanced Scorecard score from projects, publications, grants, and events', () => {
    const bsc = calculateScientistBalancedScorecard({
      scientistId: 'sci-100',
      projects: [
        {
          id: 'p-1',
          code: 'KMFRI-OCS-01',
          title: 'RV Mtafiti Deep Sea Stock Survey',
          principalInvestigatorId: 'sci-100',
          memberUserIds: ['sci-100', 'sci-200'],
          progressPercent: 85,
          status: 'Active',
        },
      ],
      reports: [
        {
          id: 'r-1',
          projectId: 'p-1',
          submittedBy: 'sci-100',
          title: 'Q3 Stock Report',
          dueDate: '2026-09-30',
          status: 'Approved',
          isOverdue: false,
        },
      ],
      outputs: [
        {
          id: 'o-1',
          projectId: 'p-1',
          authorId: 'sci-100',
          title: 'Pelagic Tuna Stock Dynamics in Kenyan EEZ',
          outputType: 'Journal Article',
          publicationStatus: 'Published',
        },
      ],
      funding: [
        {
          id: 'f-1',
          projectId: 'p-1',
          grantNumber: 'WIOMSA-2026-01',
          amount: 12000000,
          allocatedAmount: 10000000,
          spentAmount: 6800000,
          currency: 'KES',
        },
      ],
      activities: [
        {
          id: 'a-1',
          projectId: 'p-1',
          scientistId: 'sci-100',
          title: 'RV Mtafiti Offshore Acoustic Survey Cruise',
          eventType: 'RV Mtafiti Research Cruise',
          activityDate: '2026-08-14',
          location: 'Mombasa Offshore Basin',
          status: 'Completed',
          scoreWeight: 15,
        },
      ],
      documents: [
        {
          id: 'd-1',
          uploadedBy: 'sci-100',
          lastEditedBy: 'sci-100',
          name: 'RV_Mtafiti_Protocol.docx',
          type: 'Word Co-Authoring Document',
        },
      ],
    });

    expect(bsc.totalScore).toBeGreaterThan(50);
    expect(bsc.projectExecutionScore).toBeGreaterThan(15);
    expect(bsc.publicationsOutputScore).toBeGreaterThan(8);
    expect(bsc.financialGrantScore).toBeGreaterThan(10);
    expect(bsc.eventsActivitiesScore).toBeGreaterThan(5);
    expect(bsc.perspectives).toHaveLength(4);
  });
});

