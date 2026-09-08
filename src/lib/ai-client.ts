export interface ComplaintItem {
  student: string;
  issue: string;
  room: string;
  priority: string;
  status: string;
  date: string;
}

export interface ComplaintsSummaryInput {
  complaints: ComplaintItem[];
}

export interface ComplaintsSummaryOutput {
  summary: string;
}

export async function summarizeComplaintsClient(input: ComplaintsSummaryInput): Promise<ComplaintsSummaryOutput> {
  try {
    // If a hosted API endpoint is configured, try calling it
    const hostedBackendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (hostedBackendUrl) {
      const res = await fetch(`${hostedBackendUrl}/api/summarize-complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (res.ok) {
        return await res.json();
      }
    }
  } catch (e) {
    console.warn("Could not connect to hosted AI endpoint, falling back to local compilation.");
  }

  // Local compiler fallback for offline/client-only (APK/EXE) builds
  const total = input.complaints.length;
  const critical = input.complaints.filter(c => c.priority.toLowerCase() === 'high').length;
  const categories = input.complaints.reduce((acc: Record<string, number>, curr) => {
    let cat = "General Operations";
    const issue = curr.issue.toLowerCase();
    if (issue.includes('wifi') || issue.includes('internet') || issue.includes('network') || issue.includes('speed')) {
      cat = "WiFi & Network";
    } else if (issue.includes('water') || issue.includes('plumbing') || issue.includes('tap') || issue.includes('washroom') || issue.includes('toilet')) {
      cat = "Water & Plumbing";
    } else if (issue.includes('electricity') || issue.includes('fan') || issue.includes('light') || issue.includes('bulb') || issue.includes('power')) {
      cat = "Electricity & Appliances";
    } else if (issue.includes('food') || issue.includes('mess') || issue.includes('lunch') || issue.includes('dinner') || issue.includes('breakfast') || issue.includes('roti')) {
      cat = "Food & Mess Management";
    } else if (issue.includes('clean') || issue.includes('dirt') || issue.includes('sweeper') || issue.includes('dust')) {
      cat = "Sanitation & Cleaning";
    }
    
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const catSummary = Object.entries(categories)
    .map(([cat, count]) => `- **${cat}**: ${count} active issue(s)`)
    .join('\n');

  const summary = `### Executive Summary (Local Compiler)

Total Active Complaints: **${total}**
Critical / High Priority Issues: **${critical}**

**Active Categories Breakdown:**
${catSummary}

**Recommendations:**
1. Prioritize resolving the **${critical}** high-priority complaints immediately to maintain student satisfaction.
2. Address issues related to water, sanitation, or electricity as they affect basic hostel operations.
3. Coordinate with technicians for any recurring utility failures.`;

  return { summary };
}
