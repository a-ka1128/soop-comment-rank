/**
 * 시즌2 참여자 명단 (105명) 가운데 이 글에 신청한 사람.
 *
 * 닉네임이 아니라 userId 로 들고 있다. 닉네임은 수시로 바뀌고 장식이 붙지만
 * (시즌2 `마린보이7` ↔ 신청 `마린보이_`) userId 는 그대로다.
 *
 * 대조는 정확 일치 → 접두 일치 → 포함 관계 순으로 했고, 편집거리 같은 유사도는
 * 쓰지 않았다. 0.5 근처에서 아이네↔에이레네 같은 남남이 붙어 버린다.
 * 그렇게 걸러진 뒤 사람이 직접 확인한 8명을 더했다.
 */
export const SEASON2_USER_IDS = new Set([
  'collet11',              // 코렛트
  '243000',                // 천양
  'yuhatty',               // 유하띠
  'eirene0326',            // 에이레네
  'barunsang',             // 바룬상
  'callmeharuby',          // 진짜하루비 > 하루비_
  'wellro314',             // 김웰로
  'cloverprice',           // 클로버 Clover > 클로버_
  'nmalinboy76',           // 마린보이7 > 마린보이_
  'ayanesena',             // 아야네 세나 > 아야네_세나
  'baythebass',            // 베이 bay > 베이♬
  'ak6006',                // 천수이
  'tleod1818',             // 빙밍 > 빙밍_
  'sikhye1004',            // 거대별
  'toryvac',               // vic tory > 빅토리~!
  'dalta20',               // 진짜달타 > 달타!
  'leuni158',              // 르니ㅡ > 르니
  'psb010203',             // 빈스9 > 빈스
  'ohgrim0505',            // 오그림
  'wggumteuli',            // w왕꿈틀이w > 꿈틀__
  'dks336',                // 비즈니스킴 > 비즈니스킴-
  'hachi97',               // 하치HACHI > 하치_HACHI
  'nwlsfl007',             // 때찌 > 때찌*
  'doormomo',              // 문 모모 > 문모모
  'usharko0o0',            // 유샥크
  'kjhh0029',              // 카나시 Kanashi > 카나시
  'lavend0710',            // 라벤멍멍 > 라벤_
  'cjstkdbsl3',            // 깡담비
  'choiagain',             // 최또
  'neez0611',              // 니즈 > 니즈__
  'lights5655',            // 즈까락 > 즈까락∥
  '9ambler',               // 펩시제로콜라감블러 > 감블러
  'w96idqb',               // TIFFANY0421 > 티파니0421
  'kappuchan',             // 카푸카푸 > 카푸_
  'ginko001125',           // 198번
  'sircharlee',            // 찰리씨
  'plincess',              // 플리 PLI > 플리ㆍ
  'hikicomoring',          // 히키comori > 히키☆
  'sjsr4611',              // 히라1 > 히라__
  'dokkhye0000',           // 독고혜지 > 독고혜지_
  'ttmdqjarj',             // 곶곶이
  'sl0724',                // 성기사 샬롯 > 성기사샬롯
  'mygomiee',              // 마이곰이
  'rainsignac',            // 레인시냐크
  'danz59',                // 단 즈 > 단즈_
  'lina0108',              // 유시노 리냐 > 리냐_LINYA
  'soosemi432',            // 수셈이
  'aza4986',               // 주닝요 > 주닝요1
  'bbungchi',              // 연토리 뿡치 > 연토리뿡치
  'ttobeherored',          // 히어로 레드 > 히어로레드
  'madaomm',               // 마다옴 > 마다옴_
  'aengduwoo',             // 우앵두
  'nkknd300',              // ㄲㅏ마귀 > 까마귀_____
  'wpsxngotek96',          // 사랑전도사 젠투 > LOVE_젠투
  'jegaltong',             // 제갈 통 > 제갈통_
  'hyesongm',              // 어둠우주기사
  'kaksjak0730',           // 한결8008 > 한결___
  'htvv2i',                // 햇비1 > 햇비
  'yangdoki',              // 양도끼
  'bboringirl',            // 뽀린걸
  'roundpopo',             // 땡글땡글포포
  'whiteone325',           // 난워니 > 난워니-_-+
  'deathhammer',           // 데스해머쵸로키 > 데스해머쵸로
  'kirababy2',             // 유키라1 > 유키라
  'mawang0216',            // 마왕0216
  'hinqocorv',             // 힌콕
  '2059865',               // 꿀빵지
  'kwakchunshik',          // 진짜 곽춘식 > 곽춘식
  'bulgom77',              // 보디가드불독
  'sellkey',               // 셀키 > 셀키_
  'cotton1217',            // 주르르
  'lilpa0309',             // 릴파 > 릴파♬
  'viichan6',              // 비챤
  'kjm13579',              // 아마데우스최
  'taegeuk0159',           // TaeGeuk > TaeGeuk_
  'ddiddu4',               // 띠뜨띠뜨 > 치즈치즈♪
  'shandyhan',             // 섄디한
  'xxxx922',               // 도깨비루딘
  'kgywjd2210',            // 김 부각 > 김부각º
  'jangjh5409',            // 짭진호아닙니다 > 진호.
  '95962000',              // 별나무 > 별나무.
])

/**
 * 시즌2 참여자였지만 이 글에서 찾지 못한 사람. 남은 신청 댓글 전부와 대조해도
 * 닮은 이름이 없어서, 닉네임이 바뀐 게 아니라 아직 신청을 안 한 것으로 본다.
 */
export const SEASON2_UNRESOLVED = [
  '우왁굳',
  '임재천',
  '아초라',
  '폭도쫄병재박',
  '카르나르 융터르',
  '서 링',
  '이유진',
  '인디언 빔밥',
  '투냥츠',
  '녹초999',
  '도파민박사',
  '문 비',
  '새까망',
  '투미츠',
  '와앙이',
  '히키킹9',
  '냉채해파리',
  '밍턴',
  '예다YEDA',
  '공주 샤샤',
  '징버거',
  '아이네',
  '피치3',
  '아르바',
]
