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
      AI Engineer in Cape Town, building AI agents, knowledge-retrieval systems and automated data pipelines on Azure and Microsoft 365.<br/><br/>
      I take manual business processes and turn them into governed, automated workflows: grounded in approved data, auditable end to end, and safe to put in front of users.<br/><br/>
      <b>Experience highlights</b>
      <ul>
        <li>Built grounded AI agents with guardrails on Microsoft Foundry and Copilot Studio</li>
        <li>Designed an Azure AI architecture for transcript search, PII detection and redaction</li>
        <li>Replaced a manual performance-scoring process with scheduled pipelines and a live dashboard</li>
        <li>Automated approvals, notifications and form workflows across Microsoft 365</li>
      </ul>
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
<img src="https://img.shields.io/badge/Azure_OpenAI-0078D4?style=flat-square&logo=microsoftazure&logoColor=white"/>
<img src="https://img.shields.io/badge/Microsoft_Foundry-5E5E5E?style=flat-square&logo=microsoft&logoColor=white"/>
<img src="https://img.shields.io/badge/Copilot_Studio-742774?style=flat-square"/>
<img src="https://img.shields.io/badge/Azure_AI_Search-0078D4?style=flat-square&logo=microsoftazure&logoColor=white"/>
<img src="https://img.shields.io/badge/Azure_AI_Language-0078D4?style=flat-square&logo=microsoftazure&logoColor=white"/>
<img src="https://img.shields.io/badge/LLMs-412991?style=flat-square"/>
<img src="https://img.shields.io/badge/Prompt_Engineering-0F6B73?style=flat-square"/>
<img src="https://img.shields.io/badge/AI_Guardrails-A3262A?style=flat-square"/>

**Cloud & Microsoft 365**<br/>
<img src="https://img.shields.io/badge/Microsoft_Azure-0078D4?style=flat-square&logo=microsoftazure&logoColor=white"/>
<img src="https://img.shields.io/badge/Azure_Storage-0078D4?style=flat-square&logo=microsoftazure&logoColor=white"/>
<img src="https://img.shields.io/badge/Google_BigQuery-669DF6?style=flat-square&logo=googlebigquery&logoColor=white"/>
<img src="https://img.shields.io/badge/SharePoint-0078D4?style=flat-square"/>
<img src="https://img.shields.io/badge/Microsoft_Teams-6264A7?style=flat-square"/>
<img src="https://img.shields.io/badge/Microsoft_365-D83B01?style=flat-square"/>

**Automation**<br/>
<img src="https://img.shields.io/badge/Power_Automate-0066FF?style=flat-square&logo=powerautomate&logoColor=white"/>
<img src="https://img.shields.io/badge/Power_Apps-742774?style=flat-square"/>
<img src="https://img.shields.io/badge/Microsoft_Forms-008272?style=flat-square"/>
<img src="https://img.shields.io/badge/Event--driven_Workflows-555555?style=flat-square"/>

**Data & Integration**<br/>
<img src="https://img.shields.io/badge/SQL-4479A1?style=flat-square&logo=postgresql&logoColor=white"/>
<img src="https://img.shields.io/badge/REST_APIs-009688?style=flat-square"/>
<img src="https://img.shields.io/badge/Data_Pipelines-555555?style=flat-square"/>
<img src="https://img.shields.io/badge/HubSpot-FF7A59?style=flat-square&logo=hubspot&logoColor=white"/>
<img src="https://img.shields.io/badge/ClickUp-7B68EE?style=flat-square&logo=clickup&logoColor=white"/>

**Languages & Tools**<br/>
<img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white"/>
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black"/>
<img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white"/>
<img src="https://img.shields.io/badge/PowerShell-5391FE?style=flat-square&logo=powershell&logoColor=white"/>
<img src="https://img.shields.io/badge/Git-F05032?style=flat-square&logo=git&logoColor=white"/>
<img src="https://img.shields.io/badge/Replit-F26207?style=flat-square&logo=replit&logoColor=white"/>
<img src="https://img.shields.io/badge/Claude-D97757?style=flat-square&logo=anthropic&logoColor=white"/>
<img src="https://img.shields.io/badge/OpenAI_Codex-412991?style=flat-square&logo=openai&logoColor=white"/>
<img src="https://img.shields.io/badge/Microsoft_Copilot-0078D4?style=flat-square"/>

## How I Build

- **Grounded by default.** Agents answer only from approved knowledge, cite it, and decline when the evidence is missing.
- **Privacy by design.** Personal data is redacted before indexing, so nothing downstream can leak it.
- **Rules as data.** Thresholds and scoring weights live in configuration, so changes need no redeployment.
- **Least privilege.** Dashboards read published views through read-only accounts and never see raw records.
- **Verified.** Every prototype ships with tests, including independent recomputation of results.

## Selected Work

### Automated Performance-Scoring Platform
Replaced a manual, screenshot-based fortnightly leaderboard with a warehouse-driven scoring system and a live dashboard.

**Links:** [Case study (PDF)](docs/Automated_Performance_Scoring_Platform_Case_Study.pdf) · [Prototype](https://github.com/hlulanij/scoring-pipeline)

- Scheduled ingestion from a project-management platform and a CRM into BigQuery, refreshed twice daily
- Configuration-driven SQL scoring layer of 17 views, with self-rolling cycles and time-zone-correct reporting
- Least-privilege access through a read-only service account and authorised views
- Freshness monitoring, unscored-record reports and independent recomputation; totals reconciled 100% at launch

`SQL` `BigQuery` `Python` `PowerShell` `REST APIs`

### Transcript Intelligence Platform
Azure AI architecture for transcript processing, knowledge retrieval, and PII detection and redaction.

**Links:** [Prototype](https://github.com/hlulanij/transcript-intelligence)

- Combines Azure Storage, Azure AI Search, Azure OpenAI and Azure AI Language
- Redacts personal data before indexing and refuses questions about what individuals said
- Agent guardrails keep answers grounded in approved knowledge and block raw transcripts

`Azure OpenAI` `Azure AI Search` `Azure AI Language` `Microsoft Foundry`

### Grounded Business Agents
Copilot Studio agents that answer routine business queries and trigger automated actions.

**Links:** [Prototype](https://github.com/hlulanij/grounded-agent)

- Retrieval from an Azure AI Search index of approved knowledge, with responses validated against it
- Power Automate flows for submissions, approvals and notifications, joined to Power Apps, SharePoint and Forms

`Copilot Studio` `Power Automate` `Power Apps` `SharePoint`

### Weekly Pipeline Check
Automated Monday sales-pipeline email for portfolio directors, with an agent that answers questions from the same snapshot.

**Links:** [Prototype](https://github.com/hlulanij/pipeline-check)

- Calculates outlook, status and red flags once, so the email and the agent always agree
- Sends only for portfolios that have data and alerts the owner on an empty week
- Agent answers only from the latest snapshot, states the week, and replies "Not in the data." otherwise

`Copilot Studio` `Power Automate` `SharePoint` `Python`

## Connect

Open to AI engineering roles and collaboration. Reach me on [LinkedIn](https://www.linkedin.com/in/hlulanimathebula).
