import ‘./globals.css’

export const metadata = {
title: ‘커플 가계부’,
description: ‘함께 쓰는 가계부’,
}

export default function RootLayout({ children }) {
return (
<html lang="ko">
<head>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
</head>
<body>{children}</body>
</html>
)
}
