import { PrismaClient, UserRole, ClientStatus, JobStatus, ApplicationStatus, InterviewOutcome, SubmissionApprovalStatus, OfferStatus, PaymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting HireFlow ATS database seed...');

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'aureva-capital' },
    update: {},
    create: {
      id: 'org-aureva-1',
      name: 'Aureva Capital Private Limited',
      slug: 'aureva-capital',
      domain: 'aurevacapital.com',
      status: 'ACTIVE',
      settings: {
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        companyRegistration: 'U65999MH2024PTC123456',
        careersBranding: {
          headline: 'Explore Open Technology Mandates',
          introductoryCopy: 'HireFlow partners with fast-growing venture-backed startups and enterprises to source top engineering and product talent.',
          brandPrimaryColor: '#5B49D6',
          brandSecondaryColor: '#1E2A4A',
          footerCopy: '© 2026 Aureva Capital Private Limited. Powered by HireFlow ATS.',
        },
      },
    },
  });
  console.log(`✓ Organization verified: ${org.name} (${org.id})`);

  // 1b. Organization Security Policy
  await prisma.securityPolicy.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      allowedAuthMethods: ['EMAIL_PASSWORD', 'GOOGLE'],
      allowedEmailDomains: [],
      requireTwoStepVerification: true,
      otpDeliveryMethod: 'EMAIL',
      otpExpirySeconds: 300,
      otpResendCooldownSeconds: 30,
      otpMaxAttempts: 3,
      maxConcurrentSessions: 2,
      inactivityTimeoutMinutes: 30,
      warningBeforeExpiryMinutes: 5,
      sensitiveActionReverificationMinutes: 15,
    },
  });
  console.log(`✓ Security Policy initialized for: ${org.name}`);

  // 2. Users (Admin, Manager, Recruiters, Client, Candidate)
  const defaultPasswordHash =
    '$argon2id$v=19$m=19456,t=2,p=1$IkRKEEEdQpOx8veyQ4SslA$MlSeBGS431c/J5Y4rUU95tdOEzDV/O/veu9ExzhszZs'; // HireFlow@2026!

  const admin = await prisma.user.upsert({
    where: { email: 'anika.rao@hireflow.io' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: 'user-anika-rao',
      email: 'anika.rao@hireflow.io',
      name: 'Anika Rao',
      passwordHash: defaultPasswordHash,
      role: UserRole.ADMIN,
      organizationId: org.id,
      status: 'ACTIVE',
      twoFactorEnabled: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'riya.desai@hireflow.io' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: 'user-riya-desai',
      email: 'riya.desai@hireflow.io',
      name: 'Riya Desai',
      passwordHash: defaultPasswordHash,
      role: UserRole.MANAGER,
      organizationId: org.id,
      managerId: admin.id,
      status: 'ACTIVE',
      twoFactorEnabled: true,
    },
  });

  const team = await prisma.team.upsert({
    where: { id: 'team-tech-delivery' },
    update: {},
    create: {
      id: 'team-tech-delivery',
      name: 'Technology Delivery Desk',
      organizationId: org.id,
      managerId: manager.id,
    },
  });

  const recruiter1 = await prisma.user.upsert({
    where: { email: 'mitisha.p@hireflow.io' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: 'user-mitisha-patidar',
      email: 'mitisha.p@hireflow.io',
      name: 'Mitisha Patidar',
      passwordHash: defaultPasswordHash,
      role: UserRole.RECRUITER,
      organizationId: org.id,
      managerId: manager.id,
      teamId: team.id,
      status: 'ACTIVE',
    },
  });

  const recruiter2 = await prisma.user.upsert({
    where: { email: 'rahul.s@hireflow.io' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: 'user-rahul-sharma',
      email: 'rahul.s@hireflow.io',
      name: 'Rahul Sharma',
      passwordHash: defaultPasswordHash,
      role: UserRole.RECRUITER,
      organizationId: org.id,
      managerId: manager.id,
      teamId: team.id,
      status: 'ACTIVE',
    },
  });

  const recruiter3 = await prisma.user.upsert({
    where: { email: 'priya.k@hireflow.io' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: 'user-priya-kapoor',
      email: 'priya.k@hireflow.io',
      name: 'Priya Kapoor',
      passwordHash: defaultPasswordHash,
      role: UserRole.RECRUITER,
      organizationId: org.id,
      managerId: manager.id,
      teamId: team.id,
      status: 'ACTIVE',
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: 'priya.g@acmetech.com' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: 'user-priya-gupta',
      email: 'priya.g@acmetech.com',
      name: 'Priya Gupta',
      passwordHash: defaultPasswordHash,
      role: UserRole.CLIENT,
      organizationId: org.id,
      status: 'ACTIVE',
    },
  });

  const candidateUser = await prisma.user.upsert({
    where: { email: 'aarav.shah@example.com' },
    update: { passwordHash: defaultPasswordHash },
    create: {
      id: 'user-aarav-shah',
      email: 'aarav.shah@example.com',
      name: 'Aarav Shah',
      passwordHash: defaultPasswordHash,
      role: UserRole.CANDIDATE,
      organizationId: org.id,
      status: 'ACTIVE',
    },
  });
  console.log('✓ Users verified: Anika Rao (Admin), Riya Desai (Manager), 3 Recruiters, 1 Client User, 1 Candidate User');

  // Test Invitations
  const crypto = await import('crypto');
  const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

  await prisma.invitation.upsert({
    where: { tokenHash: hashToken('test-invitation-token-123') },
    update: {},
    create: {
      id: 'invitation-test-01',
      email: 'newrecruiter@hireflow.io',
      role: UserRole.RECRUITER,
      organizationId: org.id,
      invitedById: admin.id,
      tokenHash: hashToken('test-invitation-token-123'),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  await prisma.invitation.upsert({
    where: { tokenHash: hashToken('test-invitation-expired-token') },
    update: {},
    create: {
      id: 'invitation-test-expired',
      email: 'expired@hireflow.io',
      role: UserRole.RECRUITER,
      organizationId: org.id,
      invitedById: admin.id,
      tokenHash: hashToken('test-invitation-expired-token'),
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  });

  // 3. Clients
  const clientAcme = await prisma.client.upsert({
    where: { code: 'CL-1001' },
    update: {},
    create: {
      id: 'client-acme-tech',
      code: 'CL-1001',
      legalName: 'Acme Technologies Private Limited',
      industry: 'Enterprise SaaS & FinTech',
      website: 'https://acmetech.com',
      location: 'Bengaluru, Karnataka',
      relationshipOwnerId: recruiter1.id,
      organizationId: org.id,
      status: ClientStatus.ACTIVE,
      feePercentage: 8.5,
      commercialTerms: '8.5% fee on first year fixed CTC. 90 days replacement guarantee.',
    },
  });

  const clientBright = await prisma.client.upsert({
    where: { code: 'CL-1002' },
    update: {},
    create: {
      id: 'client-bright-labs',
      code: 'CL-1002',
      legalName: 'Bright Labs AI Inc',
      industry: 'Artificial Intelligence & Robotics',
      website: 'https://brightlabs.ai',
      location: 'Hyderabad, Telangana',
      relationshipOwnerId: recruiter1.id,
      organizationId: org.id,
      status: ClientStatus.ACTIVE,
      feePercentage: 9.0,
      commercialTerms: '9.0% fee on fixed CTC. Payment due within 30 days of candidate joining.',
    },
  });

  const clientNorthstar = await prisma.client.upsert({
    where: { code: 'CL-1003' },
    update: {},
    create: {
      id: 'client-northstar',
      code: 'CL-1003',
      legalName: 'Northstar Analytics Corp',
      industry: 'Data Intelligence & Cloud',
      website: 'https://northstaranalytics.io',
      location: 'Mumbai, Maharashtra',
      relationshipOwnerId: recruiter2.id,
      organizationId: org.id,
      status: ClientStatus.ACTIVE,
      feePercentage: 8.0,
      commercialTerms: '8.0% fee on CTC. 60 days replacement window.',
    },
  });

  const clientVertex = await prisma.client.upsert({
    where: { code: 'CL-1004' },
    update: {},
    create: {
      id: 'client-vertex',
      code: 'CL-1004',
      legalName: 'Vertex Systems Global',
      industry: 'FinTech & Payments Infrastructure',
      website: 'https://vertexsys.com',
      location: 'Pune, Maharashtra',
      relationshipOwnerId: recruiter3.id,
      organizationId: org.id,
      status: ClientStatus.PROSPECT,
      feePercentage: 8.5,
      commercialTerms: 'Standard MSA under negotiation.',
    },
  });

  // Client Contacts
  const contactAcme = await prisma.clientContact.upsert({
    where: { id: 'contact-acme-priya' },
    update: {},
    create: {
      id: 'contact-acme-priya',
      clientId: clientAcme.id,
      name: 'Priya Gupta',
      designation: 'Director of Talent Acquisition',
      email: 'priya.g@acmetech.com',
      phone: '+91 98450 12345',
      contactType: 'PRIMARY',
      isPrimary: true,
    },
  });

  // Client Access for Priya Gupta
  await prisma.clientAccess.upsert({
    where: {
      userId_clientId: {
        userId: clientUser.id,
        clientId: clientAcme.id,
      },
    },
    update: {},
    create: {
      id: 'access-priya-acme',
      userId: clientUser.id,
      clientId: clientAcme.id,
      status: 'ACTIVE',
    },
  });
  console.log('✓ Clients verified: Acme Technologies, Bright Labs, Northstar Analytics, Vertex Systems');

  // 4. Jobs (8 realistic mandates)
  const jobDefinitions = [
    {
      id: 'job-j201',
      code: 'J-201',
      clientId: clientAcme.id,
      title: 'Staff Frontend Architect',
      description: 'Lead architecture for Next.js, micro-frontends, high-concurrency dashboard.',
      ownerId: recruiter1.id,
      hiringManagerContactId: contactAcme.id,
      organizationId: org.id,
      openings: 2,
      location: 'Bengaluru / Hybrid',
      salaryMin: 3500000,
      salaryMax: 4500000,
      status: JobStatus.ACTIVE,
      isPublished: true,
      publishedAt: new Date('2026-11-01T10:00:00Z'),
      isSalaryPublic: true,
      hideClientName: false,
    },
    {
      id: 'job-j202',
      code: 'J-202',
      clientId: clientAcme.id,
      title: 'Senior Backend Engineer (Go / Distributed)',
      description: 'High-throughput transactional ledger services using Go and PostgreSQL.',
      ownerId: recruiter1.id,
      hiringManagerContactId: contactAcme.id,
      organizationId: org.id,
      openings: 3,
      location: 'Remote',
      salaryMin: 2800000,
      salaryMax: 3800000,
      status: JobStatus.ACTIVE,
      isPublished: true,
      publishedAt: new Date('2026-11-01T10:00:00Z'),
      isSalaryPublic: true,
      hideClientName: false,
    },
    {
      id: 'job-j203',
      code: 'J-203',
      clientId: clientBright.id,
      title: 'Engineering Manager - Cloud Infrastructure',
      description: 'Manage 12 platform engineers overseeing multi-region AWS and Kubernetes clusters.',
      ownerId: recruiter2.id,
      organizationId: org.id,
      openings: 1,
      location: 'Bengaluru',
      salaryMin: 4800000,
      salaryMax: 6000000,
      status: JobStatus.ACTIVE,
      isPublished: true,
      publishedAt: new Date('2026-11-01T10:00:00Z'),
      isSalaryPublic: false,
      hideClientName: true, // Confidential client
    },
    {
      id: 'job-j204',
      code: 'J-204',
      clientId: clientBright.id,
      title: 'Lead Machine Learning Engineer',
      description: 'Scale LLM inference pipelines, fine-tuning, and production vector indexing.',
      ownerId: recruiter2.id,
      organizationId: org.id,
      openings: 2,
      location: 'Hyderabad',
      salaryMin: 4000000,
      salaryMax: 5200000,
      status: JobStatus.ACTIVE,
      isPublished: true,
      publishedAt: new Date('2026-11-01T10:00:00Z'),
      isSalaryPublic: false,
      hideClientName: false,
    },
    {
      id: 'job-j205',
      code: 'J-205',
      clientId: clientNorthstar.id,
      title: 'Principal Data Platform Engineer',
      description: 'Spark, ClickHouse, Apache Iceberg analytics data lakehouse design.',
      ownerId: recruiter3.id,
      organizationId: org.id,
      openings: 2,
      location: 'Mumbai',
      salaryMin: 3800000,
      salaryMax: 4800000,
      status: JobStatus.ACTIVE,
      isPublished: true,
      publishedAt: new Date('2026-11-01T10:00:00Z'),
      isSalaryPublic: false,
      hideClientName: false,
    },
    {
      id: 'job-j206',
      code: 'J-206',
      clientId: clientNorthstar.id,
      title: 'Senior Product Manager - Enterprise B2B',
      description: 'Drive analytics product roadmap, customer retention, and feature prioritization.',
      ownerId: recruiter3.id,
      organizationId: org.id,
      openings: 1,
      location: 'Pune',
      salaryMin: 3000000,
      salaryMax: 4000000,
      status: JobStatus.ACTIVE,
      isPublished: false, // Active but unpublished
      publishedAt: null,
      isSalaryPublic: false,
      hideClientName: false,
    },
    {
      id: 'job-j207',
      code: 'J-207',
      clientId: clientVertex.id,
      title: 'DevOps & SRE Specialist',
      description: 'Terraform, Helm charts, CI/CD pipeline automation, and 99.99% uptime maintenance.',
      ownerId: recruiter1.id,
      organizationId: org.id,
      openings: 1,
      location: 'Pune',
      salaryMin: 3200000,
      salaryMax: 4200000,
      status: JobStatus.DRAFT,
      isPublished: false,
      publishedAt: null,
      isSalaryPublic: false,
      hideClientName: false,
    },
    {
      id: 'job-j208',
      code: 'J-208',
      clientId: clientAcme.id,
      title: 'Lead QA Automation Engineer',
      description: 'Playwright, Cypress, load testing, and test automation framework design.',
      ownerId: recruiter2.id,
      organizationId: org.id,
      openings: 1,
      location: 'Bengaluru',
      salaryMin: 2200000,
      salaryMax: 2800000,
      status: JobStatus.PAUSED,
      isPublished: false,
      publishedAt: null,
      isSalaryPublic: false,
      hideClientName: false,
      closingReason: 'Temporarily on hold pending Q1 budget re-allocation.',
    },
  ];

  for (const jd of jobDefinitions) {
    await prisma.job.upsert({
      where: { code: jd.code },
      update: {
        isPublished: jd.isPublished,
        publishedAt: jd.publishedAt,
        hideClientName: jd.hideClientName,
        isSalaryPublic: jd.isSalaryPublic,
      },
      create: jd,
    });
  }

  // Add Job Rounds to J-201
  const round1 = await prisma.jobRound.upsert({
    where: { id: 'round-j201-screening' },
    update: {},
    create: {
      id: 'round-j201-screening',
      jobId: 'job-j201',
      name: 'Technical Screening',
      roundOrder: 1,
      description: 'Initial 45-minute live coding and fundamentals review.',
    },
  });

  const round2 = await prisma.jobRound.upsert({
    where: { id: 'round-j201-arch' },
    update: {},
    create: {
      id: 'round-j201-arch',
      jobId: 'job-j201',
      name: 'System Architecture Deep-Dive',
      roundOrder: 2,
      description: '60-minute scalable frontend systems and micro-frontends review.',
    },
  });
  console.log('✓ Jobs verified: 8 realistic mandates created with interview rounds');

  // 5. Candidates (~60 realistic candidates)
  const candidatePoolData = [
    { name: 'Aarav Shah', title: 'Staff Frontend Engineer', company: 'Razorpay', exp: 8.5, cSalary: 3200000, eSalary: 4200000, notice: '15 Days', loc: 'Bengaluru', skills: ['React', 'Next.js', 'TypeScript', 'System Design', 'Redux', 'GraphQL'] },
    { name: 'Priya Sharma', title: 'Engineering Manager', company: 'Swiggy', exp: 12.0, cSalary: 4500000, eSalary: 5500000, notice: '30 Days', loc: 'Mumbai', skills: ['Leadership', 'Java', 'Spring Boot', 'Microservices', 'AWS'] },
    { name: 'Rohan Mehta', title: 'DevOps & Cloud Architect', company: 'Freshworks', exp: 9.5, cSalary: 3400000, eSalary: 4200000, notice: 'Immediate', loc: 'Pune', skills: ['Kubernetes', 'AWS', 'Terraform', 'Docker', 'Prometheus'] },
    { name: 'Ananya Verma', title: 'Senior Product Designer', company: 'CRED', exp: 6.0, cSalary: 2200000, eSalary: 3000000, notice: '30 Days', loc: 'Delhi NCR', skills: ['Figma', 'Design Systems', 'UX Research', 'Prototyping'] },
    { name: 'Vikram Joshi', title: 'Lead Machine Learning Engineer', company: 'InMobi', exp: 8.0, cSalary: 3800000, eSalary: 4800000, notice: '60 Days', loc: 'Hyderabad', skills: ['Python', 'PyTorch', 'Vector DB', 'MLOps', 'FastAPI'] },
    { name: 'Sneha Kulkarni', title: 'Senior Go Developer', company: 'Zomato', exp: 7.0, cSalary: 2700000, eSalary: 3600000, notice: 'Immediate', loc: 'Bengaluru', skills: ['Go', 'gRPC', 'PostgreSQL', 'Redis', 'Kafka'] },
    { name: 'Arjun Patel', title: 'Principal Data Engineer', company: 'Fractal Analytics', exp: 11.0, cSalary: 4200000, eSalary: 5200000, notice: '30 Days', loc: 'Mumbai', skills: ['Spark', 'Databricks', 'Airflow', 'Snowflake', 'Python'] },
    { name: 'Divya Iyer', title: 'Frontend Lead', company: 'PhonePe', exp: 7.5, cSalary: 2900000, eSalary: 3800000, notice: '15 Days', loc: 'Bengaluru', skills: ['React', 'TypeScript', 'Web Performance', 'CI/CD'] },
    { name: 'Siddharth Nair', title: 'Senior SRE', company: 'BrowserStack', exp: 6.5, cSalary: 2600000, eSalary: 3400000, notice: '30 Days', loc: 'Pune', skills: ['Linux', 'Kubernetes', 'Ansible', 'GCP', 'Terraform'] },
    { name: 'Pooja Hegde', title: 'QA Automation Architect', company: 'Thoughtworks', exp: 8.0, cSalary: 2400000, eSalary: 3200000, notice: 'Immediate', loc: 'Hyderabad', skills: ['Playwright', 'Selenium', 'Java', 'CI/CD', 'API Testing'] },
    { name: 'Manish Tiwari', title: 'Staff Backend Architect', company: 'Jio Platforms', exp: 13.0, cSalary: 5000000, eSalary: 6200000, notice: '60 Days', loc: 'Mumbai', skills: ['Java', 'Distributed Systems', 'Kafka', 'Cassandra'] },
    { name: 'Kavita Reddy', title: 'Senior React Developer', company: 'Capillary Tech', exp: 5.5, cSalary: 2000000, eSalary: 2700000, notice: '30 Days', loc: 'Bengaluru', skills: ['React', 'Tailwind CSS', 'Redux Toolkit', 'Jest'] },
    { name: 'Aditya Deshmukh', title: 'Data Scientist', company: 'Tiger Analytics', exp: 4.5, cSalary: 1800000, eSalary: 2500000, notice: '30 Days', loc: 'Pune', skills: ['Python', 'Scikit-learn', 'SQL', 'Tableau', 'NLP'] },
    { name: 'Meera Nambiar', title: 'Technical Recruiter', company: 'Amazon', exp: 5.0, cSalary: 1600000, eSalary: 2200000, notice: '15 Days', loc: 'Chennai', skills: ['Tech Sourcing', 'Boolean Search', 'Stakeholder Management'] },
    { name: 'Nikhil Saxena', title: 'Cloud Security Engineer', company: 'Palo Alto Networks', exp: 7.0, cSalary: 3000000, eSalary: 4000000, notice: '30 Days', loc: 'Delhi NCR', skills: ['AWS Security', 'IAM', 'SOC2', 'Penetration Testing'] },
    { name: 'Shruti Bhatt', title: 'Senior Product Manager', company: 'MakeMyTrip', exp: 8.0, cSalary: 3400000, eSalary: 4200000, notice: '60 Days', loc: 'Gurugram', skills: ['Roadmapping', 'User Research', 'A/B Testing', 'Growth'] },
    { name: 'Karthik Raja', title: 'Full Stack Engineer', company: 'Zoho', exp: 6.0, cSalary: 2200000, eSalary: 3000000, notice: 'Immediate', loc: 'Chennai', skills: ['Node.js', 'React', 'PostgreSQL', 'Docker'] },
    { name: 'Tanvi Agarwal', title: 'UI/UX Designer', company: 'Dunzo', exp: 4.0, cSalary: 1500000, eSalary: 2100000, notice: '15 Days', loc: 'Bengaluru', skills: ['Figma', 'Wireframing', 'User Flows', 'Illustrator'] },
    { name: 'Abhishek Roy', title: 'DevOps Engineer', company: 'Paytm', exp: 5.5, cSalary: 2100000, eSalary: 2800000, notice: '30 Days', loc: 'Noida', skills: ['Jenkins', 'Terraform', 'AWS', 'Kubernetes'] },
    { name: 'Deepa Menon', title: 'Engineering Lead', company: 'Cisco', exp: 10.0, cSalary: 4000000, eSalary: 5000000, notice: '60 Days', loc: 'Bengaluru', skills: ['C++', 'Python', 'Networking', 'Distributed Systems'] },
  ];

  // Synthesize up to 60 candidates deterministically
  const indianFirstNames = ['Rajesh', 'Suresh', 'Anita', 'Sunita', 'Gaurav', 'Varun', 'Tarun', 'Harsh', 'Neha', 'Nandini', 'Vikas', 'Alok', 'Pallavi', 'Rashmi', 'Akash', 'Kunal', 'Deepak', 'Mayank', 'Bhavna', 'Shweta', 'Amit', 'Sunil', 'Preeti', 'Kiran', 'Pranav', 'Girish', 'Smita', 'Lata', 'Mohit', 'Vipin', 'Chetan', 'Geeta', 'Monika', 'Vishal', 'Neeraj', 'Chitra', 'Naveen', 'Ashish', 'Ritu', 'Sameer'];
  const indianLastNames = ['Choudhury', 'Ganguly', 'Mukherjee', 'Bose', 'Chatterjee', 'Gupta', 'Bansal', 'Goyal', 'Mittal', 'Singhal', 'Khatri', 'Malik', 'Dahiya', 'Rathore', 'Chauhan', 'Solanki', 'Pawar', 'Shinde', 'Jadhav', 'Kadam', 'Pillai', 'Kurup', 'Warrier', 'Bhat', 'Kamath', 'Shenoy', 'Prabhu', 'Rao', 'Reddy', 'Naidu', 'Chowdary', 'Goud', 'Yadav', 'Verma', 'Thakur', 'Tripathi', 'Pandey', 'Mishra', 'Dubey', 'Shukla'];
  const titles = ['Senior Frontend Engineer', 'Backend Go Developer', 'DevOps Specialist', 'QA Engineer', 'Data Analyst', 'Product Manager', 'Cloud Architect', 'Full Stack Developer'];
  const cities = ['Bengaluru', 'Pune', 'Hyderabad', 'Mumbai', 'Delhi NCR', 'Chennai', 'Remote'];

  for (let i = candidatePoolData.length; i < 60; i++) {
    const fn = indianFirstNames[i % indianFirstNames.length];
    const ln = indianLastNames[(i * 3) % indianLastNames.length];
    const title = titles[i % titles.length];
    const city = cities[i % cities.length];
    const exp = 3 + (i % 9);
    const cSal = 1200000 + (exp * 250000);
    const eSal = Math.round(cSal * 1.3);

    candidatePoolData.push({
      name: `${fn} ${ln}`,
      title,
      company: 'Tech Solutions India',
      exp,
      cSalary: cSal,
      eSalary: eSal,
      notice: i % 3 === 0 ? 'Immediate' : i % 3 === 1 ? '30 Days' : '15 Days',
      loc: city,
      skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
    });
  }

  let candidateIndex = 1;
  const createdCandidates = [];

  for (const c of candidatePoolData) {
    const code = `C-${String(candidateIndex).padStart(4, '0')}`;
    const email = `${c.name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`;

    const candidate = await prisma.candidate.upsert({
      where: { code },
      update: {},
      create: {
        id: `cand-${code.toLowerCase()}`,
        code,
        name: c.name,
        email,
        phone: `+91 98${String(10000000 + candidateIndex).substring(0, 8)}`,
        currentTitle: c.title,
        currentCompany: c.company,
        experienceYears: c.exp,
        currentSalary: c.cSalary,
        expectedSalary: c.eSalary,
        noticePeriod: c.notice,
        location: c.loc,
        skills: c.skills,
        source: 'LinkedIn Sourced',
        ownerId: candidateIndex % 2 === 0 ? recruiter1.id : recruiter2.id,
        organizationId: org.id,
        consentRecordedAt: new Date(),
        isArchived: false,
      },
    });

    createdCandidates.push(candidate);
    candidateIndex++;
  }
  console.log(`✓ Candidates verified: ${createdCandidates.length} realistic profiles seeded`);

  // 5. Pipeline Stages & Rejection Reasons (Prompt 11)
  const defaultStages = [
    { id: 'stage-sourced', name: 'Sourced', stageType: ApplicationStatus.SOURCED, order: 1 },
    { id: 'stage-screening', name: 'Screening', stageType: ApplicationStatus.SCREENING, order: 2 },
    { id: 'stage-interview', name: 'Interview', stageType: ApplicationStatus.INTERVIEW, order: 3 },
    { id: 'stage-technical', name: 'Technical', stageType: ApplicationStatus.TECHNICAL, order: 4 },
    { id: 'stage-client-review', name: 'Client Review', stageType: ApplicationStatus.CLIENT_REVIEW, order: 5 },
    { id: 'stage-offer', name: 'Offer', stageType: ApplicationStatus.OFFER, order: 6 },
    { id: 'stage-placed', name: 'Placed', stageType: ApplicationStatus.PLACED, order: 7 },
    { id: 'stage-rejected', name: 'Rejected', stageType: ApplicationStatus.REJECTED, order: 8 },
  ];

  for (const st of defaultStages) {
    await prisma.stage.upsert({
      where: { id: st.id },
      update: { name: st.name, stageType: st.stageType, order: st.order, isArchived: false },
      create: {
        id: st.id,
        organizationId: org.id,
        name: st.name,
        stageType: st.stageType,
        order: st.order,
        isArchived: false,
      },
    });
  }

  const defaultRejectionReasons = [
    { code: 'SKILLS_MISMATCH', reason: 'Skills or Technical Competency Mismatch', category: 'QUALIFICATIONS' },
    { code: 'EXPERIENCE_INSUFFICIENT', reason: 'Insufficient Domain/Industry Experience', category: 'QUALIFICATIONS' },
    { code: 'SALARY_EXPECTATION', reason: 'Compensation Expectations Beyond Budget', category: 'COMPENSATION' },
    { code: 'LOCATION_UNAVAILABLE', reason: 'Unable to Relocate or Non-Hybrid Match', category: 'LOGISTICS' },
    { code: 'NOTICE_PERIOD', reason: 'Notice Period Too Long (> 60 Days)', category: 'TIMELINE' },
    { code: 'OFFER_DECLINED_BY_CANDIDATE', reason: 'Candidate Declined Offer / Counter-Offer Accepted', category: 'CANDIDATE_WITHDREW' },
    { code: 'POOR_CULTURE_FIT', reason: 'Culture & Working Style Alignment', category: 'INTERVIEW_FEEDBACK' },
    { code: 'FAILED_BACKGROUND_CHECK', reason: 'Background Verification Discrepancy', category: 'COMPLIANCE' },
    { code: 'OTHER', reason: 'Other / General Assessment', category: 'GENERAL' },
  ];

  for (const r of defaultRejectionReasons) {
    await prisma.rejectionReason.upsert({
      where: { code: r.code },
      update: { reason: r.reason, category: r.category, isArchived: false },
      create: { code: r.code, reason: r.reason, category: r.category, isArchived: false },
    });
  }

  // 6. Recruitment Pipeline: Applications, Stage History, Interviews, Submissions, Offers, Placement
  const candAarav = createdCandidates[0]; // C-0001
  const candPriya = createdCandidates[1]; // C-0002
  const candRohan = createdCandidates[2]; // C-0003

  // Application 1: Aarav Shah -> Staff Frontend Architect (J-201)
  const app1 = await prisma.application.upsert({
    where: {
      candidateId_jobId: {
        candidateId: candAarav.id,
        jobId: 'job-j201',
      },
    },
    update: {
      stageId: 'stage-client-review',
    },
    create: {
      id: 'app-aarav-j201',
      candidateId: candAarav.id,
      jobId: 'job-j201',
      stageId: 'stage-client-review',
      status: ApplicationStatus.CLIENT_REVIEW,
      appliedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    },
  });

  // Stage History for App 1
  await prisma.applicationStageHistory.createMany({
    data: [
      { id: 'sh-1', applicationId: app1.id, fromStage: null, toStage: 'SOURCED', changedById: recruiter1.id, comments: 'Candidate sourced via LinkedIn.' },
      { id: 'sh-2', applicationId: app1.id, fromStage: 'SOURCED', toStage: 'SCREENING', changedById: recruiter1.id, comments: 'Passed recruiter screening call.' },
      { id: 'sh-3', applicationId: app1.id, fromStage: 'SCREENING', toStage: 'CLIENT_REVIEW', changedById: recruiter1.id, comments: 'Presented standardized profile to Acme Technologies.' },
    ],
    skipDuplicates: true,
  });

  // Interview for App 1
  const interview1 = await prisma.interview.upsert({
    where: { id: 'int-aarav-j201' },
    update: {},
    create: {
      id: 'int-aarav-j201',
      applicationId: app1.id,
      roundId: round1.id,
      scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
      duration: 60,
      mode: 'VIDEO',
      provider: 'GOOGLE_MEET',
      meetingLink: 'https://meet.google.com/hfw-arch-deep',
      outcome: InterviewOutcome.SCHEDULED,
    },
  });

  // Panel & Feedback
  await prisma.interviewPanelMember.upsert({
    where: {
      interviewId_userId: {
        interviewId: interview1.id,
        userId: clientUser.id,
      },
    },
    update: {},
    create: {
      id: 'panel-priya-int1',
      interviewId: interview1.id,
      userId: clientUser.id,
      role: 'LEAD_INTERVIEWER',
    },
  });

  // Submission for App 1
  const sub1 = await prisma.submission.upsert({
    where: { code: 'S-241' },
    update: {},
    create: {
      id: 'sub-aarav-s241',
      code: 'S-241',
      applicationId: app1.id,
      version: 1,
      approvalStatus: SubmissionApprovalStatus.APPROVED,
      approvedById: manager.id,
      sentAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      clientDecision: 'INTERVIEW_REQUESTED',
      clientFeedback: 'Strong micro-frontend and architecture experience. Proceed to Technical round.',
    },
  });

  // Submission Approval sign-off
  await prisma.submissionApproval.upsert({
    where: { id: 'sub-appr-1' },
    update: {},
    create: {
      id: 'sub-appr-1',
      submissionId: sub1.id,
      reviewerId: manager.id,
      decision: 'APPROVED',
      comments: 'Standardized profile verified against Acme MSA requirements.',
      approvedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    },
  });

  // Application 2: Rohan Mehta -> DevOps Architect (J-207 / Placement closed!)
  const app2 = await prisma.application.upsert({
    where: {
      candidateId_jobId: {
        candidateId: candRohan.id,
        jobId: 'job-j207',
      },
    },
    update: {
      stageId: 'stage-placed',
    },
    create: {
      id: 'app-rohan-j207',
      candidateId: candRohan.id,
      jobId: 'job-j207',
      stageId: 'stage-placed',
      status: ApplicationStatus.PLACED,
      appliedAt: new Date(Date.now() - 21 * 24 * 3600 * 1000),
    },
  });

  const offer1 = await prisma.offer.upsert({
    where: { id: 'offer-rohan-1' },
    update: {},
    create: {
      id: 'offer-rohan-1',
      applicationId: app2.id,
      clientId: clientVertex.id,
      offeredSalary: 3800000,
      joiningDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      status: OfferStatus.ACCEPTED,
    },
  });

  const placement1 = await prisma.placement.upsert({
    where: { applicationId: app2.id },
    update: {},
    create: {
      id: 'placement-rohan-1',
      applicationId: app2.id,
      clientId: clientVertex.id,
      feeBasis: 'PERCENTAGE',
      feeAmount: 323000, // 8.5% of 38,00,000 INR = 3,23,000 INR
      paymentTerms: 'NET_30',
      dueDate: new Date(Date.now() + 45 * 24 * 3600 * 1000),
      paymentStatus: PaymentStatus.INVOICED,
    },
  });
  console.log(`✓ Placement closed: Rohan Mehta placed at Vertex Systems (Fee: ₹3,23,000 INR)`);

  // 7. Audit Log Entry (Idempotent upsert)
  await prisma.auditLog.upsert({
    where: { id: 'audit-seed-init' },
    update: {},
    create: {
      id: 'audit-seed-init',
      actorId: admin.id,
      action: 'SYSTEM_DATABASE_SEED',
      entity: 'Organization',
      entityId: org.id,
      after: {
        status: 'SUCCESS',
        seededUsers: 6,
        seededClients: 4,
        seededJobs: 8,
        seededCandidates: createdCandidates.length,
        seededPlacements: 1,
      },
      ipAddress: '127.0.0.1',
    },
  });

  console.log('✅ HireFlow ATS database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error executing database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
