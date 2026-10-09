<p align="center">
  <img src="assets/banner.svg" alt="Hlulani Mathebula, AI Engineer" width="100%"/>
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/hlulanimathebula"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white"/></a>
  <img src="https://img.shields.io/badge/Cape_Town-South_Africa-58a6ff?style=for-the-badge&logo=googlemaps&logoColor=white"/>
</p>

---

## About

<table>
  <tr>
    <td width="240" align="center"><img src="assets/ai-model.svg" width="200" alt="AI model"/></td>
    <td>
      AI Engineer building AI agents, knowledge-retrieval systems and automated data pipelines on Azure and Microsoft 365.<br/><br/>
      My work began with business automation on Power Automate, Power Apps and SharePoint, alongside Copilot Studio agents. It has grown into AI engineering: agents grounded in approved knowledge, retrieval over Azure AI Search, and data pipelines that connect business systems to them.<br/><br/>
      I care most about trust. An AI system in a business should be accurate, accountable and safe to rely on, so I design for that from the first prototype.<br/><br/>
      I work closely with the people who own a process, turning loosely stated rules into precise definitions and then into automated workflows. I also use AI-assisted development tools such as Claude, OpenAI Codex and Microsoft Copilot to move quickly, with tests and independent checks keeping the results reliable.
    </td>
  </tr>
</table>

## What I Do

| 🤖 AI Agents & LLMs | 🔗 Data & Integration | ⚙️ Automation |
|---|---|---|
| Agent instructions and guardrails | Scheduled pipelines from business systems | Approval and notification workflows |
| Knowledge retrieval and grounded answers | SQL scoring and reporting layers | Digitised forms and processes |
| Prompt engineering and evaluation | REST API and CRM integration | Event-driven flows across Microsoft 365 |

## Tech Stack

**AI & Agents**<br/>
`Azure OpenAI` `Microsoft Foundry` `Copilot Studio` `Azure AI Search` `Azure AI Language` `LLMs` `Prompt Engineering` `AI Guardrails` `Knowledge Retrieval`

**Cloud & Microsoft 365**<br/>
`Microsoft Azure` `Azure Storage` `Google BigQuery` `SharePoint` `Microsoft Teams` `Microsoft 365`

**Automation**<br/>
`Power Automate` `Power Apps` `Microsoft Forms` `Event-driven Workflows`

**Data & Integration**<br/>
`SQL` `REST APIs` `Data Pipelines` `HubSpot` `ClickUp`

**Languages & Tools**<br/>
`Python` `JavaScript` `Node.js` `PowerShell` `Git` `Replit` `Claude` `OpenAI Codex` `Microsoft Copilot`

## How I Build

- **Grounded by default.** Agents answer only from approved knowledge, cite it, and decline when the evidence is missing.
- **Privacy by design.** Personal data is redacted before indexing, so nothing downstream can leak it.
- **Rules as data.** Thresholds and scoring weights live in configuration, so changes need no redeployment.
- **Least privilege.** Dashboards read published views through read-only accounts and never see raw records.
- **Verified.** Every prototype ships with tests, including independent recomputation of results.

## Selected Work

### Automated Performance-Scoring Platform
Replaced a manual, screenshot-based fortnightly leaderboard with a warehouse-driven scoring system and a live dashboard.

**Links:** [Case study (PDF)](docs/Automated_Performance_Scoring_Platform_Case_Study.pdf) · [Prototype](https://github.com/hlulanij/performance-scoring-platform)

- Scheduled ingestion from a project-management platform and a CRM into BigQuery, refreshed twice daily
- Configuration-driven SQL scoring layer of 17 views, with self-rolling cycles and time-zone-correct reporting
- Least-privilege access through a read-only service account and authorised views
- Freshness monitoring, unscored-record reports and independent recomputation; totals reconciled 100% at launch

`SQL` `BigQuery` `Python` `PowerShell` `REST APIs`

### Transcript Intelligence Platform
Azure AI architecture for transcript processing, knowledge retrieval, and PII detection and redaction.

**Links:** [Prototype](https://github.com/hlulanij/transcript-intelligence-platform)

- Combines Azure Storage, Azure AI Search, Azure OpenAI and Azure AI Language
- Redacts personal data before indexing and refuses questions about what individuals said
- Agent guardrails keep answers grounded in approved knowledge and block raw transcripts

`Azure OpenAI` `Azure AI Search` `Azure AI Language` `Microsoft Foundry`

### Grounded Business Agents
Copilot Studio agents that answer routine business queries and trigger automated actions.

**Links:** [Prototype](https://github.com/hlulanij/grounded-business-agent)

- Retrieval from an Azure AI Search index of approved knowledge, with responses validated against it
- Power Automate flows for submissions, approvals and notifications, joined to Power Apps, SharePoint and Forms

`Copilot Studio` `Power Automate` `Power Apps` `SharePoint`

### Weekly Pipeline Check
Automated Monday sales-pipeline email for portfolio directors, with an agent that answers questions from the same snapshot.

**Links:** [Prototype](https://github.com/hlulanij/weekly-pipeline-check)

- Calculates outlook, status and red flags once, so the email and the agent always agree
- Sends only for portfolios that have data and alerts the owner on an empty week
- Agent answers only from the latest snapshot, states the week, and replies "Not in the data." otherwise

`Copilot Studio` `Power Automate` `SharePoint` `Python`

## Connect

Open to AI engineering roles and collaboration. Reach me on [LinkedIn](https://www.linkedin.com/in/hlulanimathebula).
