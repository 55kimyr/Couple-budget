export async function POST(req) {
  try {
    const { base64, mediaType } = await req.json();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 }
            },
            {
              type: "text",
              text: `이 카드 명세서나 결제 내역 이미지에서 지출 항목을 추출해줘. JSON 배열만 반환하고 다른 텍스트는 절대 쓰지 마. 마크다운 코드블록도 쓰지 마. 각 항목 형식: {"date":"YYYY-MM-DD","amount":숫자,"rawName":"원본가맹점명","memo":""} 날짜가 없으면 오늘 날짜(${new Date().toISOString().slice(0,10)}) 사용. 금액은 숫자만. 정렬은 날짜 최신순.`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("").trim();
    const parsed = JSON.parse(text);
    return Response.json({ items: parsed });
  } catch (e) {
    return Response.json({ error: "내역을 읽지 못했어요." }, { status: 500 });
  }
}
