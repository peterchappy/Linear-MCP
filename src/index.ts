import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";

import { LinearClient, LinearFetch, User } from "@linear/sdk";

// Load environment variables from .env file
dotenv.config();

// Check if LINEAR_API_KEY is defined in environment
if (!process.env.LINEAR_API_KEY) {
  console.error("Error: LINEAR_API_KEY is not defined in environment variables.");
  console.error("Please create a .env file with your Linear API key. See .env.example for format.");
  process.exit(1);
}

const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
});

// Create server instance
const server = new McpServer({
  name: "linear",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Register Linear ticket tool
server.tool(
  "get-ticket-with-comments",
  "Get a Linear ticket with all comments",
  {
    ticketId: z.string().describe("Linear ticket ID (e.g., ABC-123)"),
  },
  async ({ ticketId }) => {
    try {
      // Get the issue
      const issue = await linearClient.issue(ticketId);

      if (!issue) {
        return {
          content: [
            {
              type: "text",
              text: `Ticket ${ticketId} not found`,
            },
          ],
        };
      }

      // Get comments for the issue
      const comments = await issue.comments();
      const commentsData = comments.nodes;

      // Format ticket with comments
      const ticketDetails = `
# ${issue.title} (${ticketId})

**Status:** ${issue.state ? (await issue.state).name : "Unknown"}
**Assignee:** ${issue.assignee ? (await issue.assignee).name : "Unassigned"}
**Created:** ${new Date(issue.createdAt).toLocaleString()}

## Description
${issue.description || "No description provided"}

## Comments (${commentsData.length})
${
  commentsData.length === 0
    ? "No comments"
    : commentsData
        .map(
          (comment: any) =>
            `### ${comment.user ? comment.user.name : "Unknown"} - ${new Date(comment.createdAt).toLocaleString()}
${comment.body}`,
        )
        .join("\n\n")
}
`;

      return {
        content: [
          {
            type: "text",
            text: ticketDetails,
          },
        ],
      };
    } catch (error: unknown) {
      console.error("Error fetching ticket:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error fetching ticket ${ticketId}: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Linear MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
