# GC Board API Reference

모든 요청은 기본적으로 `https://dongwook-server.jaehwan.kr/`을 기준으로 합니다. 요청을 보호하기 위해 대부분의 엔드포인트는 `Authorization: Bearer <accessToken>` 헤더를 필요로 하며, 로그인 후 전달받은 토큰을 그대로 붙이면 됩니다.

## 인증 / 사용자

### `POST /auth/signup`
- 설명: 이메일 코드로 인증을 마친 이후 사용자 계정을 생성합니다.
- Body:
  ```json
  {
    "mailVerificationCode": "123456",
    "password": "string(8~64)",
    "nickname": "yourNickname",
    "profile": "https://example.com/avatar.png",
    "description": "자기소개 (선택)"
  }
  ```
- 응답: `204 No Content`

### `POST /auth/login`
- 설명: 닉네임/비밀번호로 로그인하면 Access/Refresh 토큰을 반환합니다.
- Body: `{ "nickname": "yourNickname", "password": "yourPassword" }`
- Response:
  ```json
  {
    "accessToken": "...",
    "refreshToken": "...",
    "tokenType": "Bearer",
    "accessTokenExpiresIn": 3600,
    "refreshTokenExpiresIn": 604800
  }
  ```

### `GET /user/profile`
- 설명: 토큰이 붙은 상태에서 본인의 프로필을 조회합니다.
- Response: `{ "mail": "...", "nickname": "...", "profile": "...", "description": "..." }`

### `GET /user/profile/{nickname}`
- 설명: 다른 닉네임의 프로필을 조회합니다.

### `PATCH /user/profile`
- 설명: 프로필/닉네임/SNS 링크를 수정합니다.
- Body: `{ "nickname":"", "profile":"https://...", "description":"" }`

## 게시글

### `POST /posts`
- 설명: 새로운 게시글을 만듭니다.
- Body: `{ "title": "제목", "content": "본문" }`
- Response: 생성된 게시글 정보

### `GET /posts`
- 설명: 커서 기반 피드. 최초 요청에는 `lastReadAt`을 생략하면 서버가 현재 시각 기준으로 데이터를 가져옵니다.
- Query: `lastReadAt`(ISO timestamp, 선택), `count`(1~50, 기본 10)
- Response:
  ```json
  {
    "content": [
      {
        "postId": "...",
        "title": "...",
        "authorNickname": "...",
        "createdAt": "...",
        "likeCount": 0,
        "liked": false
      }
    ],
    "size": 10,
    "last": false
  }
  ```
  `content` 배열의 각 항목에 `liked`(boolean) 속성이 추가되어 있고 현재 인증한 사용자가 좋아요를 눌렀으면 `true`가 됩니다.

### `GET /posts/search`
- 설명: `keyword` + `lastReadAt`/`count`로 제목/본문을 검색합니다. 입력한 각 단어에 `*` 와일드카드를 붙여 Boolean FULLTEXT(`MATCH ... AGAINST (... IN BOOLEAN MODE)`) 쿼리로 부분 검색을 지원하고, 결과는 최신순 커서 기반으로 페이지됩니다.

### `GET /posts/{postId}`
- 설명: 단건 게시글 상세(본문). 응답에 `acceptedCommentId` 포함.

### `PATCH /posts/{postId}`
- 설명: 작성자만 수정 가능.
- Body: `{ "title":"", "content":"" }`

### `DELETE /posts/{postId}`
- 설명: 작성자만 삭제.

### `POST /posts/{postId}/likes`
- 설명: 토글 좋아요. 응답 `{ "postId":"...", "liked":true, "likeCount":123 }`

## 댓글

### `POST /posts/{postId}/comments`
- 설명: 댓글 등록. 대댓글을 달려면 `parent_comment_id` 쿼리 파라미터로 부모 댓글 ID를 함께 보냅니다.
- Query: `parent_comment_id` (선택, parent 댓글 ID)
- Body: `{ "content":"..." }`

### `GET /posts/{postId}/comments`
- 설명: 커서 기반 댓글 리스트. `cursorPath`를 넣으면 그 이후 댓글부터, `parent_comment_id`를 넣으면 지정한 댓글 하위만.
- Query:
  - `cursorPath` (materialized path, 선택)
  - `count` (기본 15)
  - `parent_comment_id` (선택, parent 댓글 ID)
- Response: 댓글 트리 배열(soft delete는 `[삭제된 댓글]`로 표시).

### `POST /posts/{postId}/comments/{commentId}/accept`
- 설명: 게시글 작성자만 채택. 응답 없음.

### `DELETE /posts/{postId}/comments/{commentId}/accept`
- 설명: 채택 해제.

## 인증 정책 요약
- `Authorization: Bearer <accessToken>` 필요: 게시글/댓글 조회, 작성, 채택, 수정/삭제 등 대부분.
- 댓글 깊이는 현재 최대 2단계까지만 허용되며, 넘기면 400 에러(`댓글은 최대 2단계까지 가능합니다.`)를 반환합니다.
