export interface ResumeFixture {
  id: string;
  fileName: string;
  format: 'PDF' | 'DOCX' | 'DOC';
  rawText: string;
  expected: {
    name: string | null;
    email: string | null;
    phone: string | null;
    experienceYears: number | null;
    currentSalary: number | null;
    skills: string[];
    isScanned?: boolean;
    hasMissingFields?: boolean;
  };
}

export const SYNTHETIC_RESUME_FIXTURES: ResumeFixture[] = [
  {
    id: 'fixture-01',
    fileName: 'Aarav_Shah_Frontend_Lead.pdf',
    format: 'PDF',
    rawText: `Aarav Shah
Staff Frontend Architect
Email: aarav.shah@example.com | Phone: +91 98765 43210
Location: Mumbai, Maharashtra

Professional Summary:
Staff Frontend Architect with 8.5 years of experience architecting high-scale React, TypeScript, and Next.js applications at TechNova. Expert in micro-frontends and accessible design systems.

Technical Skills:
React, TypeScript, Next.js, Tailwind CSS, GraphQL, Node.js, Webpack, Jest

Work Experience:
TechNova - Staff Frontend Architect (2020 - Present)
- Led team of 14 engineers building core customer portal.
- Reduced LCP from 2.8s to 0.9s.

Compensation & Availability:
Current CTC: ₹32 LPA
Expected CTC: ₹45 LPA
Notice Period: 30 days`,
    expected: {
      name: 'Aarav Shah',
      email: 'aarav.shah@example.com',
      phone: '+91 98765 43210',
      experienceYears: 8.5,
      currentSalary: 3200000,
      skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL', 'Node.js'],
    },
  },
  {
    id: 'fixture-02',
    fileName: 'Rohan_Singh_DevOps.docx',
    format: 'DOCX',
    rawText: `Rohan Singh
DevOps & SRE Specialist
rohan.singh@example.com · +91 91234 56789 · Bengaluru, India

Profile:
Over 6 years of experience managing Kubernetes clusters, AWS infrastructure, and CI/CD pipelines across enterprise banking platforms.

Key Competencies:
Kubernetes, Docker, AWS, Terraform, CI/CD, Linux, Python, Go

Employment History:
Vertex Systems - Senior DevOps Engineer (2021 - Present)
- Designed zero-downtime blue/green deployment strategy.
- Automated multi-region disaster recovery using Terraform.

Notice: 60 days
Current Salary: 18 LPA
Expected Salary: 24 LPA`,
    expected: {
      name: 'Rohan Singh',
      email: 'rohan.singh@example.com',
      phone: '+91 91234 56789',
      experienceYears: 6,
      currentSalary: 1800000,
      skills: ['Kubernetes', 'Docker', 'AWS', 'Terraform', 'CI/CD', 'Linux', 'Python', 'Go'],
    },
  },
  {
    id: 'fixture-03',
    fileName: 'Priya_Kapoor_QA_Lead.doc',
    format: 'DOC',
    rawText: `Priya Kapoor
Lead QA Automation Engineer
priya.kapoor@example.com | 9876501234 | Pune

Experience: 7.5 years of experience in enterprise test automation, performance testing, and quality assurance.
Current Company: Acme Technologies

Technical Skills:
Playwright, Selenium, TypeScript, Python, Cypress, CI/CD, Git, Automation Testing

Current CTC: 16 LPA
Notice Period: 15 days`,
    expected: {
      name: 'Priya Kapoor',
      email: 'priya.kapoor@example.com',
      phone: '+91 98765 01234',
      experienceYears: 7.5,
      currentSalary: 1600000,
      skills: ['Playwright', 'Selenium', 'TypeScript', 'Python', 'Cypress', 'CI/CD', 'Git'],
    },
  },
  {
    id: 'fixture-04',
    fileName: 'Mehul_Jain_Backend_Go.pdf',
    format: 'PDF',
    rawText: `Mehul Jain
Senior Backend Engineer
mehul.jain@example.com · 9988776655 · Hyderabad
5 years experience building distributed Go microservices, PostgreSQL databases, and high-throughput Kafka streaming pipelines at Tech Solutions India.

Skills: Go, Golang, PostgreSQL, Kafka, Redis, Docker, Microservices, REST API

Availability: Immediate
Current CTC: 15 LPA`,
    expected: {
      name: 'Mehul Jain',
      email: 'mehul.jain@example.com',
      phone: '+91 99887 76655',
      experienceYears: 5,
      currentSalary: 1500000,
      skills: ['Go', 'PostgreSQL', 'Kafka', 'Redis', 'Docker', 'Microservices'],
    },
  },
  {
    id: 'fixture-05',
    fileName: 'Anita_Verma_Scanned_OCR.pdf',
    format: 'PDF',
    rawText: `[Scanned Document: Text could not be extracted directly from image layers. Please review or enter manually.]`,
    expected: {
      name: null,
      email: null,
      phone: null,
      experienceYears: null,
      currentSalary: null,
      skills: [],
      isScanned: true,
      hasMissingFields: true,
    },
  },
  {
    id: 'fixture-06',
    fileName: 'Vikram_Malhotra_Data_Engineer.pdf',
    format: 'PDF',
    rawText: `Vikram Malhotra
Principal Data Platform Engineer
vikram.malhotra@example.com | +91-98711-22334 | Gurgaon, Delhi NCR

Summary:
9 years of experience engineering data platforms, streaming pipelines, and warehouse infrastructure at Northstar Analytics.

Core Skills: Python, PostgreSQL, Kafka, Redis, AWS, Docker, Kubernetes

Notice Period: 30 days
Expected Salary: ₹35 LPA`,
    expected: {
      name: 'Vikram Malhotra',
      email: 'vikram.malhotra@example.com',
      phone: '+91 98711 22334',
      experienceYears: 9,
      currentSalary: null,
      skills: ['Python', 'PostgreSQL', 'Kafka', 'Redis', 'AWS', 'Docker', 'Kubernetes'],
      hasMissingFields: true, // Missing current salary
    },
  },
  {
    id: 'fixture-07',
    fileName: 'Ananya_Iyer_Product_Manager.docx',
    format: 'DOCX',
    rawText: `Ananya Iyer
Senior Product Manager
ananya.iyer@example.com
Location: Bengaluru
Total Experience: 8 years leading B2B SaaS products, roadmaps, and cross-functional engineering pods at Bright Labs AI.
Skills: Product Manager, Git, REST API, Agile, Jira

Current CTC: ₹28 LPA
Expected CTC: ₹38 LPA`,
    expected: {
      name: 'Ananya Iyer',
      email: 'ananya.iyer@example.com',
      phone: null, // Missing phone
      experienceYears: 8,
      currentSalary: 2800000,
      skills: ['Product Manager', 'Git', 'REST API'],
      hasMissingFields: true,
    },
  },
  {
    id: 'fixture-08',
    fileName: 'Deepak_Sharma_FullStack.pdf',
    format: 'PDF',
    rawText: `Deepak Sharma
Full Stack Engineer
deepak.sharma@example.com | 9820011223 | Mumbai

4 years experience developing web platforms using React, Node.js, TypeScript, and MongoDB.
Current Company: TechNova

Skills: React, Node.js, TypeScript, MongoDB, Tailwind CSS, Git
Notice: 30 days
CTC: 12 LPA`,
    expected: {
      name: 'Deepak Sharma',
      email: 'deepak.sharma@example.com',
      phone: '+91 98200 11223',
      experienceYears: 4,
      currentSalary: 1200000,
      skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Tailwind CSS', 'Git'],
    },
  },
  {
    id: 'fixture-09',
    fileName: 'Kavita_Nair_ML_Engineer.pdf',
    format: 'PDF',
    rawText: `Kavita Nair
Lead Machine Learning Engineer
kavita.nair@example.com | +91 98450 12345 | Chennai

7 years of experience deploying LLM fine-tuning pipelines, transformer models, and Python backend microservices at Bright Labs AI.

Skills: Python, FastAPI, Docker, Kubernetes, AWS, PostgreSQL, Git
Notice Period: 60 days
Current CTC: 30 LPA`,
    expected: {
      name: 'Kavita Nair',
      email: 'kavita.nair@example.com',
      phone: '+91 98450 12345',
      experienceYears: 7,
      currentSalary: 3000000,
      skills: ['Python', 'FastAPI', 'Docker', 'Kubernetes', 'AWS', 'PostgreSQL', 'Git'],
    },
  },
  {
    id: 'fixture-10',
    fileName: 'Siddharth_Mehta_Engineering_Manager.docx',
    format: 'DOCX',
    rawText: `Siddharth Mehta
Engineering Manager
siddharth.mehta@example.com | 9819988776 | Mumbai
12 years of experience leading software engineering organizations, distributed microservices, and high-availability cloud infrastructure.
Current Company: Acme Technologies

Expertise: Microservices, AWS, Docker, Kubernetes, Java, Spring Boot, PostgreSQL, Git
Current Salary: 42 LPA`,
    expected: {
      name: 'Siddharth Mehta',
      email: 'siddharth.mehta@example.com',
      phone: '+91 98199 88776',
      experienceYears: 12,
      currentSalary: 4200000,
      skills: ['Microservices', 'AWS', 'Docker', 'Kubernetes', 'Java', 'Spring Boot', 'PostgreSQL', 'Git'],
    },
  },
  {
    id: 'fixture-11',
    fileName: 'Sunita_Rao_Java_Developer.doc',
    format: 'DOC',
    rawText: `Sunita Rao
Senior Backend Engineer
sunita.rao@example.com | +91 97654 32109 | Hyderabad
6.5 years experience in enterprise Java, Spring Boot, Kafka, and PostgreSQL at Infosys.
Notice Period: 90 days
CTC: 14 LPA
Skills: Java, Spring Boot, Kafka, PostgreSQL, Docker, Git`,
    expected: {
      name: 'Sunita Rao',
      email: 'sunita.rao@example.com',
      phone: '+91 97654 32109',
      experienceYears: 6.5,
      currentSalary: 1400000,
      skills: ['Java', 'Spring Boot', 'Kafka', 'PostgreSQL', 'Docker', 'Git'],
    },
  },
  {
    id: 'fixture-12',
    fileName: 'Rahul_Verma_Cloud_Architect.pdf',
    format: 'PDF',
    rawText: `Rahul Verma
Cloud Architect
rahul.verma@example.com | +91 98100 44556 | Noida, Delhi NCR
10 years of experience architecting cloud migrations across AWS and GCP.
Company: Vertex Systems
Skills: AWS, GCP, Terraform, Kubernetes, Docker, Linux, CI/CD
Current CTC: 36 LPA
Notice: 30 days`,
    expected: {
      name: 'Rahul Verma',
      email: 'rahul.verma@example.com',
      phone: '+91 98100 44556',
      experienceYears: 10,
      currentSalary: 3600000,
      skills: ['AWS', 'GCP', 'Terraform', 'Kubernetes', 'Docker', 'Linux', 'CI/CD'],
    },
  },
  {
    id: 'fixture-13',
    fileName: 'Pooja_Patel_Frontend.docx',
    format: 'DOCX',
    rawText: `Pooja Patel
Frontend Developer
pooja.patel@example.com | 9898012345 | Ahmedabad
3 years experience creating dynamic single page web applications using React, JavaScript, HTML, and CSS.
Current Company: Tech Solutions India
Skills: React, JavaScript, HTML, CSS, Tailwind CSS, Git
CTC: 7 LPA
Notice: 15 days`,
    expected: {
      name: 'Pooja Patel',
      email: 'pooja.patel@example.com',
      phone: '+91 98980 12345',
      experienceYears: 3,
      currentSalary: 700000,
      skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Tailwind CSS', 'Git'],
    },
  },
  {
    id: 'fixture-14',
    fileName: 'Amit_Chopra_SRE.pdf',
    format: 'PDF',
    rawText: `Amit Chopra
DevOps & SRE Specialist
amit.chopra@example.com | +91 99001 22334 | Bengaluru
5.5 years in Site Reliability Engineering, observability, Kubernetes, and Prometheus.
Current Employer: Northstar Analytics
Skills: SRE, Kubernetes, Docker, Linux, Python, CI/CD, Terraform
Current Salary: 20 LPA`,
    expected: {
      name: 'Amit Chopra',
      email: 'amit.chopra@example.com',
      phone: '+91 99001 22334',
      experienceYears: 5.5,
      currentSalary: 2000000,
      skills: ['SRE', 'Kubernetes', 'Docker', 'Linux', 'Python', 'CI/CD', 'Terraform'],
    },
  },
  {
    id: 'fixture-15',
    fileName: 'Neha_Deshmukh_Data_Analyst.pdf',
    format: 'PDF',
    rawText: `Neha Deshmukh
Data Analyst
neha.deshmukh@example.com | 9872233445 | Pune
4 years of experience analyzing data sets, writing SQL queries, and designing dashboards.
Company: Acme Technologies
Skills: PostgreSQL, Python, Git
CTC: 10 LPA`,
    expected: {
      name: 'Neha Deshmukh',
      email: 'neha.deshmukh@example.com',
      phone: '+91 98722 33445',
      experienceYears: 4,
      currentSalary: 1000000,
      skills: ['PostgreSQL', 'Python', 'Git'],
    },
  },
  {
    id: 'fixture-16',
    fileName: 'Karan_Bhatia_Python_Backend.docx',
    format: 'DOCX',
    rawText: `Karan Bhatia
Senior Backend Engineer
karan.bhatia@example.com | +91 98111 55667 | Delhi NCR
6 years experience in Python, Django, FastAPI, Redis, and PostgreSQL.
Current Company: Bright Labs AI
Skills: Python, Django, FastAPI, Redis, PostgreSQL, Docker, Git
Notice: 30 days
Current Salary: 19 LPA`,
    expected: {
      name: 'Karan Bhatia',
      email: 'karan.bhatia@example.com',
      phone: '+91 98111 55667',
      experienceYears: 6,
      currentSalary: 1900000,
      skills: ['Python', 'Django', 'FastAPI', 'Redis', 'PostgreSQL', 'Docker', 'Git'],
    },
  },
  {
    id: 'fixture-17',
    fileName: 'Shreya_Ghosh_QA.doc',
    format: 'DOC',
    rawText: `Shreya Ghosh
QA Engineer
shreya.ghosh@example.com | 9830012345 | Kolkata
3.5 years experience in automated testing with Selenium, Java, and Jest.
Company: TCS
Skills: Selenium, Java, Jest, Automation Testing, Git
Current CTC: 8 LPA`,
    expected: {
      name: 'Shreya Ghosh',
      email: 'shreya.ghosh@example.com',
      phone: '+91 98300 12345',
      experienceYears: 3.5,
      currentSalary: 800000,
      skills: ['Selenium', 'Java', 'Jest', 'Automation Testing', 'Git'],
    },
  },
  {
    id: 'fixture-18',
    fileName: 'Gaurav_Mishra_Golang.pdf',
    format: 'PDF',
    rawText: `Gaurav Mishra
Backend Engineer
gaurav.mishra@example.com | +91 97123 45678 | Remote
4.5 years experience building Go microservices, Redis caching, and Docker containers.
Employer: TechNova
Skills: Go, Redis, Docker, PostgreSQL, REST API, Git
Notice Period: Immediate
Current CTC: 14 LPA`,
    expected: {
      name: 'Gaurav Mishra',
      email: 'gaurav.mishra@example.com',
      phone: '+91 97123 45678',
      experienceYears: 4.5,
      currentSalary: 1400000,
      skills: ['Go', 'Redis', 'Docker', 'PostgreSQL', 'REST API', 'Git'],
    },
  },
  {
    id: 'fixture-19',
    fileName: 'Divya_Menon_Frontend.pdf',
    format: 'PDF',
    rawText: `Divya Menon
Frontend Engineer
divya.menon@example.com | 9847098765 | Chennai
5 years experience specializing in React, Next.js, TypeScript, and responsive CSS.
Company: Vertex Systems
Skills: React, Next.js, TypeScript, CSS, Tailwind CSS, Git
Notice: 30 days
CTC: 13.5 LPA`,
    expected: {
      name: 'Divya Menon',
      email: 'divya.menon@example.com',
      phone: '+91 98470 98765',
      experienceYears: 5,
      currentSalary: 1350000,
      skills: ['React', 'Next.js', 'TypeScript', 'CSS', 'Tailwind CSS', 'Git'],
    },
  },
  {
    id: 'fixture-20',
    fileName: 'Arjun_Reddy_FullStack.docx',
    format: 'DOCX',
    rawText: `Arjun Reddy
Full Stack Engineer
arjun.reddy@example.com | +91 98490 11223 | Hyderabad
7 years of full stack software engineering using React, Node.js, TypeScript, and AWS.
Current Company: Tech Solutions India
Skills: React, Node.js, TypeScript, AWS, Docker, PostgreSQL, Git
Notice Period: 45 days
Current Salary: 21 LPA`,
    expected: {
      name: 'Arjun Reddy',
      email: 'arjun.reddy@example.com',
      phone: '+91 98490 11223',
      experienceYears: 7,
      currentSalary: 2100000,
      skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'Docker', 'PostgreSQL', 'Git'],
    },
  },
];
