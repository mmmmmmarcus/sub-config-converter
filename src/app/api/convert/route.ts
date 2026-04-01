import { NextRequest, NextResponse } from "next/server";
import { convertConfig } from "@/lib/converter";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const target = formData.get("target");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传配置文件。" }, { status: 400 });
    }

    if (target !== "clash" && target !== "surge") {
      return NextResponse.json({ error: "目标格式不合法。" }, { status: 400 });
    }

    const content = await file.text();
    const output = convertConfig(content, target);

    return NextResponse.json({
      output,
      filename: file.name.replace(/\.[^.]+$/, "") + (target === "clash" ? ".yaml" : ".conf"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "转换失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
