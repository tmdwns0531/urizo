import { services } from "@/composition";
import { errorResponse } from "../../_shared/http";

export async function POST(): Promise<Response> {
  try {
    await services.reset();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
