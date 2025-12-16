const titles = [
  "JavaScript의 비동기 처리 완벽 가이드",
  "React Hooks 사용법 정리",
  "TypeScript 제네릭 이해하기",
  "웹 성능 최적화 방법",
  "CSS Grid vs Flexbox 비교",
  "REST API 설계 베스트 프랙티스",
  "Docker를 활용한 개발 환경 구축",
  "Git 브랜치 전략 정리",
  "클린 코드 작성하는 법",
  "데이터베이스 인덱스 최적화",
  "Next.js 13 App Router 알아보기",
  "Node.js 이벤트 루프 이해하기",
  "GraphQL vs REST API",
  "웹 보안 기초 - XSS와 CSRF",
  "AWS 서비스 소개",
  "테스트 주도 개발(TDD) 시작하기",
  "함수형 프로그래밍 개념",
  "마이크로서비스 아키텍처 입문",
  "Redis 캐싱 전략",
  "Kubernetes 기초"
];

const contents = [
  "프로미스와 async/await을 활용한 비동기 처리 방법을 자세히 알아봅니다.",
  "useState, useEffect, useContext 등 React Hooks의 핵심 개념을 정리했습니다.",
  "제네릭을 사용하여 재사용 가능한 컴포넌트를 만드는 방법입니다.",
  "웹사이트 로딩 속도를 개선하기 위한 다양한 최적화 기법을 소개합니다.",
  "레이아웃 구성에 적합한 CSS 기술을 비교 분석합니다.",
  "확장 가능하고 유지보수하기 쉬운 API 설계 원칙을 배워봅시다.",
  "컨테이너 기술을 활용하여 일관된 개발 환경을 만드는 방법입니다.",
  "Git Flow, GitHub Flow 등 효과적인 브랜치 관리 전략을 알아봅니다.",
  "가독성 좋고 유지보수하기 쉬운 코드를 작성하는 원칙들입니다.",
  "쿼리 성능을 향상시키기 위한 인덱스 활용법을 정리했습니다.",
  "Next.js의 새로운 App Router 기능과 사용법을 살펴봅니다.",
  "Node.js의 핵심 개념인 이벤트 루프를 자세히 설명합니다.",
  "두 API 스타일의 장단점을 비교하고 선택 기준을 알아봅니다.",
  "웹 애플리케이션의 주요 보안 취약점과 대응 방법을 다룹니다.",
  "클라우드 서비스의 기본 개념과 주요 서비스를 소개합니다.",
  "테스트를 먼저 작성하는 개발 방법론을 배워봅니다.",
  "순수 함수, 불변성 등 함수형 프로그래밍의 핵심 개념입니다.",
  "모놀리식에서 마이크로서비스로 전환하는 방법을 알아봅니다.",
  "인메모리 데이터베이스를 활용한 효과적인 캐싱 전략입니다.",
  "컨테이너 오케스트레이션 도구의 기본 사용법을 익혀봅시다."
];

async function createPosts() {
  const apiBase = 'http://localhost:8080';
  
  // 먼저 로그인 (닉네임과 비밀번호는 이미 생성된 계정 사용)
  console.log('로그인 중...');
  const loginRes = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'lian0408', password: 'dongw28489' })
  });
  
  if (!loginRes.ok) {
    console.error('로그인 실패. 먼저 testuser 계정을 생성해주세요.');
    return;
  }
  
  const { accessToken, tokenType } = await loginRes.json();
  console.log('로그인 성공!');
  
  // 200개 게시글 생성
  for (let i = 1; i <= 200; i++) {
    const titleIndex = (i - 1) % titles.length;
    const contentIndex = (i - 1) % contents.length;
    const title = `${titles[titleIndex]} #${i}`;
    const content = `${contents[contentIndex]} (게시글 번호: ${i})`;
    
    try {
      const res = await fetch(`${apiBase}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${tokenType} ${accessToken}`
        },
        body: JSON.stringify({ title, content })
      });
      
      if (res.ok) {
        console.log(`게시글 ${i}/200 생성 완료`);
      } else {
        console.error(`게시글 ${i} 생성 실패:`, await res.text());
      }
      
      // API 부하 방지를 위한 약간의 딜레이
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`게시글 ${i} 생성 중 오류:`, error.message);
    }
  }
  
  console.log('200개 게시글 생성 완료!');
}

createPosts();
