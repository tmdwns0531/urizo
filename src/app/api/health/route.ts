import {
  isFullyDemoConfig,
  readAdapterConfig,
} from "@/config/adapters";
import { errorResponse } from "../_shared/http";

export async function GET(): Promise<Response> {
  try {
    const config = readAdapterConfig();
    return Response.json({
      status: "ok",
      mode: config.appProfile,
      fullyDemo: isFullyDemoConfig(config),
      adapters: {
        auth: config.auth,
        catalog: config.catalog,
        search: config.search,
        selector: config.selector,
        runStore: config.runStore,
        traceStore: config.traceStore,
        engagementStore: config.engagementStore,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
