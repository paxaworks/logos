import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Send, Coins, PenTool, X, Settings, Key, Check, Sparkles, Box } from 'lucide-react';
import objectsData from './objects.json';

const LogosGame = () => {
  // --- 게임 화면 상태 ---
  const [screen, setScreen] = useState('menu'); // 'menu' | 'game'

  // --- 게임 상태 관리 ---
  const [gameState, setGameState] = useState('planning');
  const [prompt, setPrompt] = useState('');

  // 오브젝트 및 인벤토리
  const [objects, setObjects] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // 자원 관리
  const MAX_INVENTORY = 8;
  const MAX_TOKENS = 8;
  const [tokens, setTokens] = useState(MAX_TOKENS);

  // API 키 설정
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [selectedMode, setSelectedMode] = useState(null); // 'basic' | 'ai'

  // AI 모드 여부
  const isAIMode = selectedMode === 'ai' && apiKey.length > 0;

  // 채팅 상태
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const requestRef = useRef();

  const GRAVITY = 0.5;
  const PLAYER_SPEED = 3;
  const JUMP_FORCE = -10;
  const STEP_HEIGHT = 35;

  const INITIAL_PLAYER = {
    x: 50,
    y: 500,
    vx: 0,
    vy: 0,
    width: 20,
    height: 100,
    grounded: true,
    color: '#ffffff',
    state: 'idle',
    cycle: 0
  };

  const playerRef = useRef({ ...INITIAL_PLAYER });
  const objectsRef = useRef([]);
  const spriteRef = useRef(null);
  const spriteLoadedRef = useRef(false);
  const goalImageRef = useRef(null);
  const goalImageLoadedRef = useRef(false);
  const objectImagesRef = useRef({});

  // 사다리 스프라이트 ref 추가
  const ladderSpriteRef = useRef(null);
  const ladderSpriteLoadedRef = useRef(false);

  // 걷기 스프라이트 ref 추가
  const walkSpriteRef = useRef(null);
  const walkSpriteLoadedRef = useRef(false);

  // 배경 구름 데이터
  const cloudsRef = useRef([]);
  const backgroundInitializedRef = useRef(false);

  // 스프라이트 이미지 로딩
  useEffect(() => {
    const img = new Image();
    img.src = '/character.png';
    img.onload = () => {
      spriteRef.current = img;
      spriteLoadedRef.current = true;
    };

    // 사다리 스프라이트 로딩
    const ladderImg = new Image();
    ladderImg.src = '/ladder.png';
    ladderImg.onload = () => {
      ladderSpriteRef.current = ladderImg;
      ladderSpriteLoadedRef.current = true;
    };

    // 걷기 스프라이트 로딩
    const walkImg = new Image();
    walkImg.src = '/walk.png';
    walkImg.onload = () => {
      walkSpriteRef.current = walkImg;
      walkSpriteLoadedRef.current = true;
    };

    // 골 이미지 로딩
    const goalImg = new Image();
    goalImg.src = '/goal.png';
    goalImg.onload = () => {
      goalImageRef.current = goalImg;
      goalImageLoadedRef.current = true;
    };

    // 거미줄 이미지 미리 로딩
    const spiderwebImg = new Image();
    spiderwebImg.src = '/spiderweb.png';
    spiderwebImg.onload = () => {
      objectImagesRef.current['/spiderweb.png'] = spiderwebImg;
    };
  }, []);

  // 스프라이트 프레임 정의
  // character.png: idle, jump, fall 용
  // walk.png (wa.png): 걷기 전용 (2848x1504, 6x2=12프레임, 각 474x752)
  // ladder.png: 사다리 전용
  const SPRITE_FRAMES = {
    walk: [
      // 상단 6프레임 (너비 470으로 여백 확보)
      { x: 0, y: 0, w: 470, h: 752 },
      { x: 474, y: 0, w: 470, h: 752 },
      { x: 948, y: 0, w: 470, h: 752 },
      { x: 1422, y: 0, w: 470, h: 752 },
      { x: 1896, y: 0, w: 470, h: 752 },
      { x: 2370, y: 0, w: 470, h: 752 },
      // 하단 6프레임
      { x: 0, y: 752, w: 470, h: 752 },
      { x: 474, y: 752, w: 470, h: 752 },
      { x: 948, y: 752, w: 470, h: 752 },
      { x: 1422, y: 752, w: 470, h: 752 },
      { x: 1896, y: 752, w: 470, h: 752 },
      { x: 2370, y: 752, w: 470, h: 752 }
    ],
    jump: [{ x: 530, y: 0, w: 98, h: 181 }],
    fall: [{ x: 10, y: 181, w: 137, h: 182 }],
    ladder: [
      { x: 0, y: 0, w: 172, h: 363 },
      { x: 172, y: 0, w: 172, h: 363 },
      { x: 344, y: 0, w: 172, h: 363 },
      { x: 516, y: 0, w: 172, h: 363 }
    ],
    idle: [{ x: 10, y: 0, w: 98, h: 181 }]  // 서있는 자세
  };

  // API 키 저장
  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', tempApiKey);
    setApiKey(tempApiKey);
    setShowSettings(false);
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'ai',
      text: tempApiKey ? "AI 모드 활성화! 이제 무엇이든 만들 수 있어요." : "기본 모드로 전환되었습니다."
    }]);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showSettings) setShowSettings(false);
        else if (selectedSlot !== null) setSelectedSlot(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSlot, showSettings]);

  // --- Gemini API 호출 ---
  const callGemini = async (userText) => {
    if (!apiKey) return null;

    try {
      const systemPrompt = `
      You are a 'Vector Game Asset Generator' for a puzzle platformer game.

      Create objects that players can use as platforms to help a character reach a goal.

      RULES:
      1. Use 'parts' array with rects, circles, and triangles to create the object.
      2. All coordinates are relative (0-100 scale).
      3. Be creative but keep objects functional as platforms.
      4. Include a friendly Korean message describing what you made.

      Output JSON Schema:
      {
        "renderType": "vector",
        "shape": "custom",
        "parts": [
          { "type": "rect|circle|triangle", "x": 0-100, "y": 0-100, "w": 1-100, "h": 1-100, "color": "#HexColor" }
        ],
        "physics": "solid|bounce|ice|hazard",
        "width": 60-200,
        "height": 40-150,
        "name": "한글이름(6자이내)",
        "message": "친근한 한국어 설명"
      }
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userText }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
          })
        }
      );

      if (!response.ok) throw new Error("API Error");
      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return JSON.parse(textResponse);
    } catch (error) {
      console.error("Gemini API Error:", error);
      return null;
    }
  };

  // --- 색상 파서 ---
  const parseColor = (text) => {
    const colors = {
      '빨간': '#EF4444', '빨강': '#EF4444', '레드': '#EF4444',
      '파란': '#3B82F6', '파랑': '#3B82F6', '블루': '#3B82F6',
      '초록': '#22C55E', '녹색': '#22C55E', '그린': '#22C55E',
      '노란': '#EAB308', '노랑': '#EAB308', '옐로우': '#EAB308',
      '주황': '#F97316', '오렌지': '#F97316',
      '보라': '#A855F7', '퍼플': '#A855F7',
      '분홍': '#EC4899', '핑크': '#EC4899',
      '하얀': '#FFFFFF', '흰색': '#FFFFFF', '화이트': '#FFFFFF',
      '검은': '#1F2937', '검정': '#1F2937', '블랙': '#1F2937',
      '갈색': '#92400E', '브라운': '#92400E',
      '회색': '#6B7280', '그레이': '#6B7280',
      '하늘': '#38BDF8', '스카이': '#38BDF8',
      '금색': '#F59E0B', '골드': '#F59E0B',
      '은색': '#9CA3AF', '실버': '#9CA3AF',
    };

    for (const [key, value] of Object.entries(colors)) {
      if (text.includes(key)) return value;
    }
    return null;
  };

  // --- 크기 파서 ---
  const parseSize = (text) => {
    if (text.includes('거대') || text.includes('엄청 큰') || text.includes('초대형')) return 2.0;
    if (text.includes('큰') || text.includes('대형')) return 1.5;
    if (text.includes('작은') || text.includes('소형') || text.includes('미니')) return 0.6;
    if (text.includes('아주 작은') || text.includes('초소형')) return 0.4;
    return 1.0;
  };

  // 방향 파싱 (회전)
  const parseDirection = (text) => {
    // 각도 기반 회전
    if (text.includes('270도') || text.includes('270°')) return '270';
    if (text.includes('180도') || text.includes('180°')) return '180';
    if (text.includes('90도') || text.includes('90°')) return '90';
    // 방향 기반 회전
    if (text.includes('오른쪽') || text.includes('우측')) return 'right';
    if (text.includes('왼쪽') || text.includes('좌측')) return 'left';
    // 반전
    if (text.includes('거울') || text.includes('미러')) return 'mirror';
    if (text.includes('뒤집') || text.includes('반대') || text.includes('플립')) return 'flip';
    return null;
  };

  // 단일 파트를 90도 시계방향 회전
  const rotatePart90 = (part) => {
    const newPart = { ...part };
    if (part.type === 'rect' || part.type === 'triangle') {
      newPart.x = 100 - part.y - part.h;
      newPart.y = part.x;
      newPart.w = part.h;
      newPart.h = part.w;
    } else if (part.type === 'circle') {
      newPart.x = 100 - part.y - part.h;
      newPart.y = part.x;
      const tempW = part.w;
      newPart.w = part.h;
      newPart.h = tempW;
    } else if (part.type === 'ellipse') {
      newPart.cx = 100 - part.cy;
      newPart.cy = part.cx;
      newPart.rx = part.ry;
      newPart.ry = part.rx;
    }
    return newPart;
  };

  // 단일 파트를 좌우 반전
  const flipPartHorizontal = (part) => {
    const newPart = { ...part };
    if (part.type === 'rect' || part.type === 'circle' || part.type === 'triangle') {
      newPart.x = 100 - part.x - part.w;
    } else if (part.type === 'ellipse') {
      newPart.cx = 100 - part.cx;
    }
    return newPart;
  };

  // 단일 파트를 상하 반전
  const flipPartVertical = (part) => {
    const newPart = { ...part };
    if (part.type === 'rect' || part.type === 'circle' || part.type === 'triangle') {
      newPart.y = 100 - part.y - part.h;
    } else if (part.type === 'ellipse') {
      newPart.cy = 100 - part.cy;
    }
    return newPart;
  };

  // parts를 회전시키는 함수
  const rotateParts = (parts, direction) => {
    if (!parts || !direction) return parts;

    return parts.map(part => {
      if (direction === '90' || direction === 'right') {
        // 90도 시계방향
        return rotatePart90(part);
      } else if (direction === '180') {
        // 180도 회전 = 90도 2번
        return rotatePart90(rotatePart90(part));
      } else if (direction === '270' || direction === 'left') {
        // 270도 시계방향 = 90도 3번
        return rotatePart90(rotatePart90(rotatePart90(part)));
      } else if (direction === 'flip' || direction === 'mirror') {
        // 좌우 반전
        return flipPartHorizontal(part);
      }
      return { ...part };
    });
  };

  // --- 로컬 프리셋 (JSON 기반) ---
  const localParsePrompt = (text) => {
    const lowerText = text.trim().toLowerCase();
    const customColor = parseColor(text);
    const sizeMultiplier = parseSize(text);
    const direction = parseDirection(text);

    // priority 높은 순으로 정렬하여 매칭
    const sortedObjects = Object.entries(objectsData)
      .sort((a, b) => (b[1].priority || 50) - (a[1].priority || 50));

    let matched = null;
    for (const [objName, objData] of sortedObjects) {
      // excludeKeywords 체크 (예: 문 -> 문제, 문서 제외)
      if (objData.excludeKeywords) {
        const hasExclude = objData.excludeKeywords.some(k => lowerText.includes(k));
        if (hasExclude) continue;
      }

      // 일반 키워드 매칭
      const hasKeyword = objData.keywords.some(k => lowerText.includes(k));

      // 소문자 키워드 매칭 (TV, moon 등)
      const hasLowerKeyword = objData.keywordsLower
        ? objData.keywordsLower.some(k => lowerText.includes(k))
        : false;

      if (hasKeyword || hasLowerKeyword) {
        matched = { name: objName, ...objData };
        break;
      }
    }

    // 매칭된 오브젝트가 없으면 기본 블록
    if (!matched) {
      const name = text.substring(0, 6);
      const width = Math.round(80 * sizeMultiplier);
      const height = Math.round(80 * sizeMultiplier);
      return {
        renderType: 'vector',
        shape: 'custom',
        parts: [{ type: 'rect', x: 0, y: 0, w: 100, h: 100, color: customColor || '#6B7280' }],
        physics: 'solid',
        width,
        height,
        name,
        message: `"${name}" 블록을 만들었어요!`,
        color: customColor || '#6B7280'
      };
    }

    // 매칭된 오브젝트 데이터 처리
    const baseColor = customColor || matched.color;
    let width = Math.round(matched.size[0] * sizeMultiplier);
    let height = Math.round(matched.size[1] * sizeMultiplier);

    // 회전 시 가로/세로 크기 교환
    if (direction === 'right' || direction === 'left') {
      const temp = width;
      width = height;
      height = temp;
    }

    // parts 색상 처리: 첫 번째 파트 또는 color가 없는 파트에 baseColor 적용
    let parts = matched.parts ? matched.parts.map(part => {
      if (part.color) return { ...part };
      return { ...part, color: baseColor };
    }) : [];

    // 방향에 따라 parts 회전
    if (direction) {
      parts = rotateParts(parts, direction);
    }

    return {
      renderType: matched.renderType || 'vector',
      imageUrl: matched.imageUrl,
      shape: matched.shape || 'custom',
      parts,
      physics: matched.physics || 'solid',
      slowEffect: matched.slowEffect,
      waterEffect: matched.waterEffect,
      width,
      height,
      name: matched.name,
      message: matched.message,
      color: baseColor,
      direction
    };
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (gameState !== 'planning') return;

    if (tokens <= 0) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: "토큰이 부족해요! 리셋하면 토큰이 충전돼요." }]);
      return;
    }
    if (inventory.length >= MAX_INVENTORY) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: "인벤토리가 가득 찼어요! 아이템을 배치하거나 버려주세요." }]);
      return;
    }

    const currentPrompt = prompt;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: currentPrompt }]);
    setPrompt('');
    setIsTyping(true);

    let itemData = null;
    let chatResponse = "";

    // AI 모드면 Gemini 호출
    if (isAIMode) {
      const aiData = await callGemini(currentPrompt);
      if (aiData) {
        itemData = aiData;
        chatResponse = aiData.message || "만들었어요!";
      }
    }

    // AI 실패하거나 기본 모드면 로컬 파서 사용
    if (!itemData) {
      const localData = localParsePrompt(currentPrompt);
      itemData = localData;
      chatResponse = localData.message;
    }

    // 기본값 보정 (이미지 타입이 아닌 경우에만)
    if (itemData.renderType !== 'image') {
      itemData.renderType = 'vector';
      const specialShapes = ['triangle', 'circle', 'arch', 'star', 'heart', 'rainbow', 'happy', 'sad', 'tube', 'playbutton', 'light', 'lightning'];
      if (!itemData.parts?.length && !specialShapes.includes(itemData.shape)) {
        itemData.parts = [{
          type: 'rect',
          x: 0, y: 0, w: 100, h: 100,
          color: itemData.color || '#6B7280'
        }];
      }
    }

    const newItem = {
      id: Date.now(),
      ...itemData,
      name: itemData.name ? itemData.name.substring(0, 6) : "물체"
    };

    setInventory(prev => [...prev, newItem]);
    setTokens(prev => prev - 1);
    setIsTyping(false);
    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: chatResponse }]);
  };

  const handleCanvasClick = (e) => {
    if (gameState !== 'planning' || selectedSlot === null) return;
    const item = inventory[selectedSlot];
    if (!item) return;

    const newObj = { ...item, x: mousePos.x - item.width / 2, y: mousePos.y - item.height / 2 };
    setObjects(prev => [...prev, newObj]);
    objectsRef.current = [...objectsRef.current, newObj];
    setInventory(prev => prev.filter((_, i) => i !== selectedSlot));
    setSelectedSlot(null);
  };

  const handleDeleteItem = (index, e) => {
    e.stopPropagation();
    setInventory(prev => prev.filter((_, i) => i !== index));
    if (selectedSlot === index) setSelectedSlot(null);
    else if (selectedSlot !== null && selectedSlot > index) setSelectedSlot(prev => prev - 1);
  };

  const handleCanvasContextMenu = (e) => {
    e.preventDefault();
    if (selectedSlot !== null) setSelectedSlot(null);
  };

  const resetGame = () => {
    setGameState('planning');
    const canvas = canvasRef.current;
    const FLOOR_OFFSET = 130;
    playerRef.current = {
      ...INITIAL_PLAYER,
      x: 50,
      y: canvas ? canvas.height - FLOOR_OFFSET - 100 : 500
    };
    setObjects([]);
    objectsRef.current = [];
    setInventory([]);
    setTokens(MAX_TOKENS);
    setSelectedSlot(null);
    setMessages([
      { id: Date.now(), role: 'ai', text: "리셋 완료! 새로운 오브젝트를 만들어보세요." }
    ]);
  };

  const getSurfaceHeight = (obj, px) => {
    const relX = px - obj.x;
    if (relX < 0 || relX > obj.width) return null;

    const scaleX = obj.width / 100;
    const scaleY = obj.height / 100;

    // 물고기 충돌 (실제 그리기 형태와 일치)
    // 몸통: ellipse(55, 50, rx=35, ry=28)
    // 꼬리: 삼각형 (0,25)-(0,75)-(20,50)
    // 지느러미: (45,5)-(55,22)-(65,22) 삼각형
    if (obj.name === '물고기') {
      const localX = relX / scaleX;

      // 지느러미 영역 (45~65, 위쪽)
      if (localX >= 45 && localX <= 65) {
        // 삼각형: (45,5)가 꼭대기, (55,22)-(65,22)가 밑변
        // 왼쪽 사면: x=45에서 55로 갈 때 y=5에서 22로
        // 오른쪽 사면: x=55에서 65로 갈 때 y=5에서 22로
        if (localX <= 55) {
          const finY = 5 + (22 - 5) * (localX - 45) / 10;
          // 몸통 타원 상단과 비교해서 더 높은 것 반환
          const bodyDx = localX - 55;
          const bodyRatio = 1 - (bodyDx * bodyDx) / (35 * 35);
          const bodyY = 50 - Math.sqrt(Math.max(0, bodyRatio)) * 28;
          return obj.y + Math.min(finY, bodyY) * scaleY;
        } else {
          const finY = 5 + (22 - 5) * (65 - localX) / 10;
          const bodyDx = localX - 55;
          const bodyRatio = 1 - (bodyDx * bodyDx) / (35 * 35);
          const bodyY = 50 - Math.sqrt(Math.max(0, bodyRatio)) * 28;
          return obj.y + Math.min(finY, bodyY) * scaleY;
        }
      }

      // 꼬리 영역 (0~20)
      if (localX >= 0 && localX < 20) {
        // 삼각형: (0,25)-(0,75)-(20,50)
        // x=0일 때 y=25~75, x=20일 때 y=50
        const topY = 25 + (50 - 25) * (localX / 20);
        return obj.y + topY * scaleY;
      }

      // 몸통 영역 (타원: 중심 55, rx=35, ry=28)
      const bodyDx = localX - 55;
      if (Math.abs(bodyDx) <= 35) {
        const ratio = 1 - (bodyDx * bodyDx) / (35 * 35);
        const dy = Math.sqrt(Math.max(0, ratio)) * 28;
        return obj.y + (50 - dy) * scaleY;
      }
      return null;
    }

    // 슬라임 충돌 (물방울 형태 - 실제 그리기 형태와 일치)
    if (obj.name === '슬라임') {
      const localX = relX / scaleX; // 0~100 범위로 정규화

      // 물방울 형태: 위쪽이 뾰족하고 아래가 둥근 형태
      // 가장 위: y=10 (x=50 지점)
      // 가장 넓은 부분: y=70 (x=10~90)
      // 바닥: y=100

      // x 위치에 따른 상단 경계 계산 (물방울 곡선)
      const cx = 50; // 중심
      const dx = Math.abs(localX - cx);

      // 물방울 형태의 상단 곡선 근사
      // x=50일 때 y=10 (꼭대기), x=10 또는 x=90일 때 y=70 (가장 넓은 부분)
      if (localX >= 10 && localX <= 90) {
        // 물방울 상단 곡선: 거리에 따라 y가 10에서 70으로 변화
        const normalizedDist = dx / 40; // 0~1 범위
        // 곡선 형태로 계산 (quadratic 느낌)
        const topY = 10 + 60 * Math.pow(normalizedDist, 1.5);
        return obj.y + topY * scaleY;
      }
      return null;
    }

    // 강아지 충돌 (실제 그리기 형태와 일치)
    // 귀: ellipse(8,25,rx=8,ry=15), ellipse(42,25,rx=8,ry=15)
    // 머리: arc(25,40,r=22)
    // 몸통: ellipse(55,65,rx=35,ry=25)
    // 꼬리: (90,55)-(95,35)-(85,55)
    if (obj.name === '강아지') {
      const localX = relX / scaleX;

      // 왼쪽 귀 (중심 8, ry=15, 세로 타원)
      if (localX >= 0 && localX <= 16) {
        const dx = Math.abs(localX - 8);
        if (dx <= 8) {
          const ratio = 1 - (dx * dx) / (8 * 8);
          const dy = Math.sqrt(Math.max(0, ratio)) * 15;
          return obj.y + (25 - dy) * scaleY;
        }
      }

      // 오른쪽 귀 (중심 42, ry=15)
      if (localX >= 34 && localX <= 50) {
        const dx = Math.abs(localX - 42);
        if (dx <= 8) {
          const ratio = 1 - (dx * dx) / (8 * 8);
          const dy = Math.sqrt(Math.max(0, ratio)) * 15;
          return obj.y + (25 - dy) * scaleY;
        }
      }

      // 머리 (원: 중심 25, 반지름 22)
      const headDx = Math.abs(localX - 25);
      if (headDx <= 22) {
        const dy = Math.sqrt(Math.max(0, 22 * 22 - headDx * headDx));
        return obj.y + (40 - dy) * scaleY;
      }

      // 꼬리 (90,55)-(95,35)-(85,55) 삼각형
      if (localX >= 85 && localX <= 100) {
        // 꼬리는 곡선이지만 대략 삼각형으로 근사
        const tailY = 35 + (55 - 35) * Math.abs(localX - 95) / 10;
        // 몸통과 비교
        const bodyDx = Math.abs(localX - 55);
        if (bodyDx <= 35) {
          const ratio = 1 - (bodyDx * bodyDx) / (35 * 35);
          const bodyY = 65 - Math.sqrt(Math.max(0, ratio)) * 25;
          return obj.y + Math.min(tailY, bodyY) * scaleY;
        }
        return obj.y + tailY * scaleY;
      }

      // 몸통 (타원: 중심 55, rx=35, ry=25)
      const bodyDx = Math.abs(localX - 55);
      if (bodyDx <= 35) {
        const ratio = 1 - (bodyDx * bodyDx) / (35 * 35);
        const dy = Math.sqrt(Math.max(0, ratio)) * 25;
        return obj.y + (65 - dy) * scaleY;
      }
      return null;
    }

    // 토끼 충돌 (실제 그리기 형태와 일치)
    // 귀: ellipse(35,18,rx=10,ry=25), ellipse(65,18,rx=10,ry=25)
    // 머리: arc(50,50,r=25)
    // 몸통: ellipse(50,75,rx=30,ry=25)
    if (obj.name === '토끼') {
      const localX = relX / scaleX;

      // 왼쪽 귀 (중심 35, rx=10, ry=25)
      if (localX >= 25 && localX <= 45) {
        const dx = Math.abs(localX - 35);
        if (dx <= 10) {
          const ratio = 1 - (dx * dx) / (10 * 10);
          const dy = Math.sqrt(Math.max(0, ratio)) * 25;
          // 귀 꼭대기: y = 18 - 25 = -7 (실제로는 0 근처)
          return obj.y + Math.max(0, 18 - dy) * scaleY;
        }
      }

      // 오른쪽 귀 (중심 65, rx=10, ry=25)
      if (localX >= 55 && localX <= 75) {
        const dx = Math.abs(localX - 65);
        if (dx <= 10) {
          const ratio = 1 - (dx * dx) / (10 * 10);
          const dy = Math.sqrt(Math.max(0, ratio)) * 25;
          return obj.y + Math.max(0, 18 - dy) * scaleY;
        }
      }

      // 머리 (원: 중심 50, 반지름 25)
      const headDx = Math.abs(localX - 50);
      if (headDx <= 25) {
        const dy = Math.sqrt(Math.max(0, 25 * 25 - headDx * headDx));
        return obj.y + (50 - dy) * scaleY;
      }

      // 몸통 (타원: 중심 50, rx=30, ry=25) - 머리 아래에 있음
      const bodyDx = Math.abs(localX - 50);
      if (bodyDx <= 30) {
        const ratio = 1 - (bodyDx * bodyDx) / (30 * 30);
        const dy = Math.sqrt(Math.max(0, ratio)) * 25;
        return obj.y + (75 - dy) * scaleY;
      }
      return null;
    }

    // 고양이 충돌 (실제 그리기 형태와 일치)
    // 왼쪽 귀: 삼각형 (28,25)-(20,5)-(40,20)
    // 오른쪽 귀: 삼각형 (72,25)-(80,5)-(60,20)
    // 머리: arc(50,40,r=25)
    // 몸통: ellipse(50,70,rx=30,ry=25)
    // 꼬리: (80,70)-(95,45)-(75,65)
    if (obj.name === '고양이') {
      const localX = relX / scaleX;

      // 왼쪽 귀 (삼각형: 꼭대기 (20,5))
      if (localX >= 20 && localX <= 40) {
        // (20,5)가 꼭대기, (28,25)와 (40,20)이 밑변
        if (localX <= 28) {
          // 왼쪽 사면: x=20에서 28로 갈 때 y=5에서 25로
          const earY = 5 + (25 - 5) * (localX - 20) / 8;
          return obj.y + earY * scaleY;
        } else {
          // 오른쪽 사면: x=28에서 40으로 갈 때 y=25에서 20으로 (그리고 머리와 만남)
          const earY = 25 - (25 - 20) * (localX - 28) / 12;
          // 머리 원과 비교
          const headDx = Math.abs(localX - 50);
          if (headDx <= 25) {
            const headY = 40 - Math.sqrt(Math.max(0, 25 * 25 - headDx * headDx));
            return obj.y + Math.min(earY, headY) * scaleY;
          }
          return obj.y + earY * scaleY;
        }
      }

      // 오른쪽 귀 (삼각형: 꼭대기 (80,5))
      if (localX >= 60 && localX <= 80) {
        if (localX >= 72) {
          // 오른쪽 사면: x=72에서 80으로 갈 때 y=25에서 5로
          const earY = 25 - (25 - 5) * (localX - 72) / 8;
          return obj.y + earY * scaleY;
        } else {
          // 왼쪽 사면: x=60에서 72로 갈 때 y=20에서 25로
          const earY = 20 + (25 - 20) * (localX - 60) / 12;
          // 머리 원과 비교
          const headDx = Math.abs(localX - 50);
          if (headDx <= 25) {
            const headY = 40 - Math.sqrt(Math.max(0, 25 * 25 - headDx * headDx));
            return obj.y + Math.min(earY, headY) * scaleY;
          }
          return obj.y + earY * scaleY;
        }
      }

      // 꼬리 (80,70)-(95,45)-(75,65)
      if (localX >= 75 && localX <= 100) {
        // 꼬리는 곡선이지만 대략 계산
        const tailY = 45 + (70 - 45) * Math.abs(localX - 95) / 20;
        // 몸통과 비교
        const bodyDx = Math.abs(localX - 50);
        if (bodyDx <= 30) {
          const ratio = 1 - (bodyDx * bodyDx) / (30 * 30);
          const bodyY = 70 - Math.sqrt(Math.max(0, ratio)) * 25;
          return obj.y + Math.min(tailY, bodyY) * scaleY;
        }
        return obj.y + tailY * scaleY;
      }

      // 머리 (원: 중심 50, 반지름 25)
      const headDx = Math.abs(localX - 50);
      if (headDx <= 25) {
        const dy = Math.sqrt(Math.max(0, 25 * 25 - headDx * headDx));
        return obj.y + (40 - dy) * scaleY;
      }

      // 몸통 (타원: 중심 50, rx=30, ry=25)
      const bodyDx = Math.abs(localX - 50);
      if (bodyDx <= 30) {
        const ratio = 1 - (bodyDx * bodyDx) / (30 * 30);
        const dy = Math.sqrt(Math.max(0, ratio)) * 25;
        return obj.y + (70 - dy) * scaleY;
      }
      return null;
    }

    // 아이스크림 충돌 (실제 그리기 형태와 일치)
    // 맨 위 스쿱 (노랑): arc(50,10,r=15)
    // 두번째 스쿱 (핫핑크): arc(50,22,r=20)
    // 세번째 스쿱 (분홍): arc(50,38,r=25)
    // 콘: 삼각형 (50,100)-(20,45)-(80,45)
    if (obj.name === '아이스크림') {
      const localX = relX / scaleX;
      const cx = 50;

      // 맨 위 스쿱 (노랑, r=15)
      const topDx = Math.abs(localX - cx);
      if (topDx <= 15) {
        const dy = Math.sqrt(Math.max(0, 15 * 15 - topDx * topDx));
        return obj.y + (10 - dy) * scaleY;
      }

      // 두번째 스쿱 (핫핑크, r=20)
      if (topDx <= 20) {
        const dy = Math.sqrt(Math.max(0, 20 * 20 - topDx * topDx));
        return obj.y + (22 - dy) * scaleY;
      }

      // 세번째 스쿱 (분홍, r=25)
      if (topDx <= 25) {
        const dy = Math.sqrt(Math.max(0, 25 * 25 - topDx * topDx));
        return obj.y + (38 - dy) * scaleY;
      }

      // 콘 영역 (삼각형: 20~80)
      if (localX >= 20 && localX <= 80) {
        // 콘 상단은 y=45, 밑변은 20~80
        // 스쿱과 겹치는 부분은 스쿱이 우선
        return obj.y + 45 * scaleY;
      }
      return null;
    }

    // 휴지 충돌 (실제 그리기 형태와 일치)
    // 박스: rect(10,20,80,70)
    // 휴지 (위로 나온 부분): 곡선 (35,25)-(50,0)-(65,25)
    if (obj.name === '휴지' || obj.name === '티슈' || obj.name === '화장지') {
      const localX = relX / scaleX;

      // 휴지 위로 나온 부분 (35~65 영역)
      if (localX >= 35 && localX <= 65) {
        // 곡선: x=50에서 y=0 (가장 높음), x=35,65에서 y=25
        const dx = Math.abs(localX - 50);
        // 2차 곡선 근사
        const tissueY = (dx * dx) / (15 * 15) * 25;
        return obj.y + tissueY * scaleY;
      }

      // 박스 영역 (10~90)
      if (localX >= 10 && localX <= 90) {
        return obj.y + 20 * scaleY;
      }
      return null;
    }

    // 병아리 충돌 (실제 그리기 형태와 일치)
    // 머리: arc(50,30,r=28)
    // 몸통: ellipse(50,65,rx=40,ry=35)
    if (obj.name === '병아리') {
      const localX = relX / scaleX;

      // 머리 (원: 중심 50, 반지름 28)
      const headDx = Math.abs(localX - 50);
      if (headDx <= 28) {
        const dy = Math.sqrt(Math.max(0, 28 * 28 - headDx * headDx));
        return obj.y + (30 - dy) * scaleY;
      }

      // 몸통 (타원: 중심 50, rx=40, ry=35)
      const bodyDx = Math.abs(localX - 50);
      if (bodyDx <= 40) {
        const ratio = 1 - (bodyDx * bodyDx) / (40 * 40);
        const dy = Math.sqrt(Math.max(0, ratio)) * 35;
        return obj.y + (65 - dy) * scaleY;
      }
      return null;
    }

    // 닭 충돌 (실제 그리기 형태와 일치)
    // 볏: ellipse(50,12,rx=10,ry=15)
    // 머리: arc(50,30,r=22)
    // 몸통: ellipse(45,60,rx=35,ry=30)
    if (obj.name === '닭') {
      const localX = relX / scaleX;

      // 볏 (타원: 중심 50, rx=10, ry=15)
      const combDx = Math.abs(localX - 50);
      if (combDx <= 10) {
        const ratio = 1 - (combDx * combDx) / (10 * 10);
        const dy = Math.sqrt(Math.max(0, ratio)) * 15;
        return obj.y + (12 - dy) * scaleY;
      }

      // 머리 (원: 중심 50, 반지름 22)
      const headDx = Math.abs(localX - 50);
      if (headDx <= 22) {
        const dy = Math.sqrt(Math.max(0, 22 * 22 - headDx * headDx));
        return obj.y + (30 - dy) * scaleY;
      }

      // 부리 (72~90 영역)
      if (localX >= 72 && localX <= 90) {
        // 삼각형: (72,30)-(90,35)-(72,40)
        const beakY = 30 + (35 - 30) * (localX - 72) / 18;
        return obj.y + beakY * scaleY;
      }

      // 몸통 (타원: 중심 45, rx=35, ry=30)
      const bodyDx = Math.abs(localX - 45);
      if (bodyDx <= 35) {
        const ratio = 1 - (bodyDx * bodyDx) / (35 * 35);
        const dy = Math.sqrt(Math.max(0, ratio)) * 30;
        return obj.y + (60 - dy) * scaleY;
      }
      return null;
    }

    // 펭귄 충돌 (실제 그리기 형태와 일치)
    // 머리: arc(50,25,r=25)
    // 몸통: ellipse(50,60,rx=40,ry=40)
    if (obj.name === '펭귄') {
      const localX = relX / scaleX;

      // 머리 (원: 중심 50, 반지름 25)
      const headDx = Math.abs(localX - 50);
      if (headDx <= 25) {
        const dy = Math.sqrt(Math.max(0, 25 * 25 - headDx * headDx));
        return obj.y + (25 - dy) * scaleY;
      }

      // 몸통 (타원: 중심 50, rx=40, ry=40)
      const bodyDx = Math.abs(localX - 50);
      if (bodyDx <= 40) {
        const ratio = 1 - (bodyDx * bodyDx) / (40 * 40);
        const dy = Math.sqrt(Math.max(0, ratio)) * 40;
        return obj.y + (60 - dy) * scaleY;
      }
      return null;
    }

    // 항아리 충돌 (실제 그리기 형태와 일치)
    // 입구: ellipse(50,10,rx=20,ry=8)
    // 목: rect(35,10,30,15)
    // 상단: ellipse(50,35,rx=35,ry=25)
    // 하단: ellipse(50,65,rx=45,ry=35)
    if (obj.name === '항아리') {
      const localX = relX / scaleX;

      // 입구 (타원: 중심 50, rx=20, ry=8)
      const topDx = Math.abs(localX - 50);
      if (topDx <= 20) {
        const ratio = 1 - (topDx * topDx) / (20 * 20);
        const dy = Math.sqrt(Math.max(0, ratio)) * 8;
        return obj.y + (10 - dy) * scaleY;
      }

      // 목 (rect: 35~65, y=10)
      if (localX >= 35 && localX <= 65) {
        return obj.y + 10 * scaleY;
      }

      // 상단 몸통 (타원: 중심 50, rx=35, ry=25)
      const midDx = Math.abs(localX - 50);
      if (midDx <= 35) {
        const ratio = 1 - (midDx * midDx) / (35 * 35);
        const dy = Math.sqrt(Math.max(0, ratio)) * 25;
        return obj.y + (35 - dy) * scaleY;
      }

      // 하단 몸통 (타원: 중심 50, rx=45, ry=35)
      const botDx = Math.abs(localX - 50);
      if (botDx <= 45) {
        const ratio = 1 - (botDx * botDx) / (45 * 45);
        const dy = Math.sqrt(Math.max(0, ratio)) * 35;
        return obj.y + (65 - dy) * scaleY;
      }
      return null;
    }

    // 알약 충돌 (실제 그리기 형태와 일치 - 캡슐 모양)
    // 왼쪽 반원: ellipse(25,50,rx=25,ry=45)
    // 오른쪽 반원: ellipse(75,50,rx=25,ry=45)
    // 중앙: rect(25,5,50,90)
    if (obj.name === '알약') {
      const localX = relX / scaleX;

      // 왼쪽 반원 (0~25)
      if (localX <= 25) {
        const dx = Math.abs(localX - 25);
        const ratio = 1 - (dx * dx) / (25 * 25);
        const dy = Math.sqrt(Math.max(0, ratio)) * 45;
        return obj.y + (50 - dy) * scaleY;
      }

      // 오른쪽 반원 (75~100)
      if (localX >= 75) {
        const dx = Math.abs(localX - 75);
        const ratio = 1 - (dx * dx) / (25 * 25);
        const dy = Math.sqrt(Math.max(0, ratio)) * 45;
        return obj.y + (50 - dy) * scaleY;
      }

      // 중앙 (25~75)
      if (localX >= 25 && localX <= 75) {
        return obj.y + 5 * scaleY;
      }
      return null;
    }

    // 모자 충돌 (실제 그리기 형태와 일치)
    // 상단: ellipse(50,40,rx=30,ry=15)
    // 본체: rect(20,40,60,50)
    // 챙: ellipse(50,90,rx=50,ry=12)
    if (obj.name === '모자') {
      const localX = relX / scaleX;

      // 상단 (타원: 중심 50, rx=30, ry=15)
      const topDx = Math.abs(localX - 50);
      if (topDx <= 30) {
        const ratio = 1 - (topDx * topDx) / (30 * 30);
        const dy = Math.sqrt(Math.max(0, ratio)) * 15;
        return obj.y + (40 - dy) * scaleY;
      }

      // 본체 (20~80, y=40)
      if (localX >= 20 && localX <= 80) {
        return obj.y + 40 * scaleY;
      }

      // 챙 (0~100, y=90 - 타원)
      const brimDx = Math.abs(localX - 50);
      if (brimDx <= 50) {
        const ratio = 1 - (brimDx * brimDx) / (50 * 50);
        const dy = Math.sqrt(Math.max(0, ratio)) * 12;
        return obj.y + (90 - dy) * scaleY;
      }
      return null;
    }

    // 꽃 충돌 (실제 그리기 형태와 일치)
    // 꽃잎들: 5개의 원 (중심 30,30 / 70,30 / 50,15 / 35,50 / 65,50, 각 r=15)
    // 줄기: rect(45,50,10,50)
    if (obj.name === '꽃') {
      const localX = relX / scaleX;

      // 상단 꽃잎 (중심 50, y=15, r=15)
      const topDx = Math.abs(localX - 50);
      if (topDx <= 15) {
        const dy = Math.sqrt(Math.max(0, 15 * 15 - topDx * topDx));
        return obj.y + (15 - dy) * scaleY;
      }

      // 왼쪽 상단 꽃잎 (중심 30, y=30, r=15)
      const leftTopDx = Math.abs(localX - 30);
      if (leftTopDx <= 15) {
        const dy = Math.sqrt(Math.max(0, 15 * 15 - leftTopDx * leftTopDx));
        return obj.y + (30 - dy) * scaleY;
      }

      // 오른쪽 상단 꽃잎 (중심 70, y=30, r=15)
      const rightTopDx = Math.abs(localX - 70);
      if (rightTopDx <= 15) {
        const dy = Math.sqrt(Math.max(0, 15 * 15 - rightTopDx * rightTopDx));
        return obj.y + (30 - dy) * scaleY;
      }

      // 왼쪽 하단 꽃잎 (중심 35, y=50, r=15)
      const leftBotDx = Math.abs(localX - 35);
      if (leftBotDx <= 15) {
        const dy = Math.sqrt(Math.max(0, 15 * 15 - leftBotDx * leftBotDx));
        return obj.y + (50 - dy) * scaleY;
      }

      // 오른쪽 하단 꽃잎 (중심 65, y=50, r=15)
      const rightBotDx = Math.abs(localX - 65);
      if (rightBotDx <= 15) {
        const dy = Math.sqrt(Math.max(0, 15 * 15 - rightBotDx * rightBotDx));
        return obj.y + (50 - dy) * scaleY;
      }

      // 줄기 (45~55, y=50)
      if (localX >= 45 && localX <= 55) {
        return obj.y + 50 * scaleY;
      }
      return null;
    }

    // 달 충돌 (실제 그리기 형태와 일치 - 원형)
    // 본체: ellipse(50,50,rx=40,ry=40)
    if (obj.name === '달') {
      const localX = relX / scaleX;

      // 원 (중심 50, 반지름 40)
      const dx = Math.abs(localX - 50);
      if (dx <= 40) {
        const dy = Math.sqrt(Math.max(0, 40 * 40 - dx * dx));
        return obj.y + (50 - dy) * scaleY;
      }
      return null;
    }

    // 우산 충돌 (실제 그리기 형태와 일치)
    // 캐노피: 삼각형 (50,0)-(100,40)-(0,40)
    // 손잡이: 선 (50,35)-(50,80) + J자 곡선
    if (obj.name === '우산') {
      const localX = relX / scaleX;

      // 캐노피 삼각형 (0~100)
      if (localX >= 0 && localX <= 100) {
        let canopyY;
        if (localX <= 50) {
          // 왼쪽 사면: x=0에서 y=40, x=50에서 y=0
          canopyY = 40 - (40 / 50) * localX;
        } else {
          // 오른쪽 사면: x=50에서 y=0, x=100에서 y=40
          canopyY = (40 / 50) * (localX - 50);
        }
        return obj.y + canopyY * scaleY;
      }
      return null;
    }

    // 자석 충돌 (실제 그리기 형태와 일치 - U자 모양)
    // 왼쪽 다리: (5,0)-(25,0)-(25,50) + 곡선
    // 오른쪽 다리: (75,0)-(95,0)-(75,50) + 곡선
    // thickness = 20
    if (obj.name === '자석' || obj.physics === 'magnet') {
      const localX = relX / scaleX;

      // 왼쪽 다리 (5~25)
      if (localX >= 5 && localX <= 25) {
        return obj.y; // y=0에서 시작
      }

      // 오른쪽 다리 (75~95)
      if (localX >= 75 && localX <= 95) {
        return obj.y; // y=0에서 시작
      }

      // 중간 부분은 U자 아래쪽 곡선 (25~75)
      // 외부 원: 반지름 45, 내부 원: 반지름 25
      if (localX > 25 && localX < 75) {
        const dx = Math.abs(localX - 50);
        // 외부 곡선
        const outerR = 45;
        if (dx <= outerR) {
          const outerDy = Math.sqrt(Math.max(0, outerR * outerR - dx * dx));
          return obj.y + (50 + outerDy) * scaleY;
        }
      }
      return null;
    }

    if (obj.parts && obj.parts.length > 0) {
      let highestY = null;
      const scaleX = obj.width / 100;
      const scaleY = obj.height / 100;

      const isAbsoluteCoords = obj.parts.some(p => p.x > 100 || p.w > 100);
      const sX = isAbsoluteCoords ? 1 : scaleX;
      const sY = isAbsoluteCoords ? 1 : scaleY;

      for (const part of obj.parts) {
        // 장식용 파트는 충돌 판정에서 제외
        if (part.decorative) continue;

        // ellipse 타입 별도 처리 (cx, cy, rx, ry 사용)
        if (part.type === 'ellipse') {
          const cx = (part.cx || 50) * sX;
          const cy = (part.cy || 50) * sY;
          const rx = (part.rx || 25) * sX;
          const ry = (part.ry || 25) * sY;
          const dx = relX - cx;
          if (Math.abs(dx) <= rx) {
            const ratio = 1 - (dx * dx) / (rx * rx);
            const dy = Math.sqrt(Math.max(0, ratio)) * ry;
            const worldY = obj.y + cy - dy;
            if (highestY === null || worldY < highestY) {
              highestY = worldY;
            }
          }
          continue;
        }

        const pX = part.x * sX;
        const pY = part.y * sY;
        const pW = part.w * sX;
        const pH = part.h * sY;

        if (relX >= pX && relX <= pX + pW) {
          let currentY = null;
          const localPartX = relX - pX;

          if (part.type === 'rect') {
            currentY = pY;
          } else if (part.type === 'circle') {
            const r = pW / 2;
            const cx = r;
            const dx = localPartX - cx;
            const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
            const scaledDy = dy * (pH / pW);
            currentY = (pY + pH / 2) - scaledDy;
          } else if (part.type === 'triangle') {
            if (localPartX < pW / 2) {
              const slope = -pH / (pW / 2);
              currentY = (pY + pH) + slope * localPartX;
            } else {
              const slope = pH / (pW / 2);
              currentY = pY + slope * (localPartX - pW / 2);
            }
          }

          if (currentY !== null) {
            const worldY = obj.y + currentY;
            if (highestY === null || worldY < highestY) {
              highestY = worldY;
            }
          }
        }
      }
      return highestY;
    }

    if (obj.shape === 'triangle') {
      if (relX < obj.width / 2) {
        const slope = -obj.height / (obj.width / 2);
        return (obj.y + obj.height) + slope * relX;
      } else {
        const slope = obj.height / (obj.width / 2);
        return obj.y + slope * (relX - obj.width / 2);
      }
    }
    else if (obj.shape === 'arch') {
      const nx = (relX / obj.width) * 2 - 1;
      const archHeight = obj.height * 0.8;
      return (obj.y + obj.height) - (1 - nx * nx) * archHeight;
    }
    else if (obj.shape === 'circle') {
      const r = obj.width / 2;
      const dx = relX - r;
      const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
      return (obj.y + obj.height / 2) - dy;
    }
    else if (obj.shape === 'tube') {
      // 튜브: 원 모양 판정 (circle과 동일)
      const r = obj.width / 2;
      const dx = relX - r;
      const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
      return (obj.y + obj.height / 2) - dy;
    }
    else if (obj.shape === 'heart') {
      // 하트: 원 모양 판정으로 처리
      const r = obj.width / 2;
      const dx = relX - r;
      const dy = Math.sqrt(Math.max(0, r * r - dx * dx));
      return (obj.y + obj.height / 2) - dy;
    }

    return obj.y;
  };

  const update = () => {
    if (gameState === 'playing') {
      const p = playerRef.current;

      // X 이동 전에 옆면 충돌 체크
      const nextX = p.x + p.vx;
      let canMoveX = true;

      // X 충돌 체크 비활성화 - 테스트용

      if (canMoveX) {
        p.x += p.vx;
      }

      // 엘리베이터 움직임 처리
      objectsRef.current.forEach(obj => {
        if (obj.physics === 'elevator') {
          if (!obj.elevatorData) {
            obj.elevatorData = { startY: obj.y, direction: -1, range: 150 };
          }
          const data = obj.elevatorData;
          obj.y += data.direction * 1.5;

          if (obj.y <= data.startY - data.range) {
            data.direction = 1;
          } else if (obj.y >= data.startY) {
            data.direction = -1;
          }
        }

        // 풍선: 계속 위로 올라감 (다른 오브젝트에 막히면 멈춤)
        if (obj.physics === 'floating' && !obj.floatStopped) {
          const nextY = obj.y - 1;
          let blocked = false;

          // 다른 오브젝트와 충돌 체크
          objectsRef.current.forEach(other => {
            if (other === obj) return;
            if (other.physics === 'ghost' || other.physics === 'floating') return;

            // 풍선이 위로 올라갈 때 다른 오브젝트 아래에 닿으면 멈춤
            if (obj.x < other.x + other.width && obj.x + obj.width > other.x) {
              if (nextY < other.y + other.height && obj.y >= other.y + other.height) {
                blocked = true;
                obj.y = other.y + other.height;
              }
            }
          });

          if (!blocked) {
            obj.y = nextY;
          }

          // 화면 위로 나가면 그냥 사라짐 (리스폰 안 함)
          if (obj.y + obj.height < 0) {
            obj.floatStopped = true;
          }
        }
      });

      objectsRef.current.forEach(obj => {
        // bounce 오브젝트는 옆면 충돌 없이 통과 (위에서 밟을 때만 작동)
        if (obj.physics === 'ghost' || obj.physics === 'ladder' || obj.physics === 'bounce') return;

        // 캐릭터와 오브젝트가 수직으로 겹치는지 체크 (캐릭터 전체 높이 기준)
        const isVerticallyOverlapping = (p.y < obj.y + obj.height) && (p.y + p.height > obj.y);

        if (isVerticallyOverlapping) {
          const pCenter = p.x + p.width/2;
          const oCenter = obj.x + obj.width/2;
          const overlapX = (p.width + obj.width)/2 - Math.abs(pCenter - oCenter);

          if (overlapX > 0) {
            // 위에서 밟을 수 있는지 체크 - 표면이 STEP_HEIGHT 이내면 올라가기
            const frontX = p.vx > 0 ? p.x + p.width + 5 : p.x - 5;
            const surfaceY = getSurfaceHeight(obj, frontX);

            if (surfaceY !== null) {
              const distToTop = (p.y + p.height) - surfaceY;

              // 올라갈 수 있는 높이면 올라가기
              if (distToTop >= 0 && distToTop <= STEP_HEIGHT) {
                p.y = surfaceY - p.height;
                p.vy = 0;
                p.grounded = true;
                return;
              }

              // 내려가는 경우 (표면이 발보다 아래) - 충돌 없이 통과해서 떨어지기
              if (distToTop < 0) {
                return;
              }
            }

            // 올라갈 수 없으면 옆면 충돌 - 밀어내기
            if (pCenter < oCenter) p.x = obj.x - p.width;
            else p.x = obj.x + obj.width;
          }
        }
      });

      // 사다리 체크를 먼저 수행
      let onLadderEarly = false;
      let ladderVy = 0;
      objectsRef.current.forEach(obj => {
        if (obj.physics === 'ladder') {
          const pBottom = p.y + p.height;
          const ladderTop = obj.y;
          const ladderBottom = obj.y + obj.height;
          const xOverlap = p.x < obj.x + obj.width && p.x + p.width > obj.x;

          // 아래에서 사다리 하단에 닿으면 올라가기 시작 (판정 범위 넓게)
          if (xOverlap && !p.ladderDirection) {
            // 캐릭터 발이 사다리 하단 근처에 있고, 아래에서 접근
            if (pBottom >= ladderBottom - 40 && pBottom <= ladderBottom + 20) {
              p.ladderDirection = 'up';
              p.currentLadder = obj;
            }
          }

          // 올라가는 중
          if (p.ladderDirection === 'up' && p.currentLadder === obj) {
            onLadderEarly = true;
            ladderVy = -3;

            // 사다리 맨 위에 도달
            if (pBottom <= ladderTop + 5) {
              p.ladderDirection = null;
              p.currentLadder = null;
              p.y = ladderTop - p.height;
              p.vy = 0;
              p.vx = PLAYER_SPEED; // 앞으로 이동 시작
              p.grounded = true;
              onLadderEarly = false;
            }
          }

          // 내려가는 중
          if (p.ladderDirection === 'down' && p.currentLadder === obj) {
            onLadderEarly = true;
            ladderVy = 2;

            // 사다리 맨 아래에 도달
            if (pBottom >= ladderBottom - 5) {
              p.ladderDirection = null;
              p.currentLadder = null;
              p.vy = 0;
              onLadderEarly = false;
            }
          }
        }
      });

      // 사다리에서 X축으로 벗어나면 리셋
      if (p.currentLadder) {
        const ladder = p.currentLadder;
        if (p.x >= ladder.x + ladder.width || p.x + p.width <= ladder.x) {
          p.ladderDirection = null;
          p.currentLadder = null;
        }
      }

      if (onLadderEarly) {
        p.vy = ladderVy;
      } else if (!p.grounded) {
        p.vy += GRAVITY;
      }
      p.y += p.vy;
      p.grounded = false;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const FLOOR_OFFSET = 130; // 인벤토리 공간 확보
      const floorY = canvas.height - FLOOR_OFFSET;
      if (p.x < 150 && p.y + p.height > floorY) { p.y = floorY - p.height; p.vy = 0; p.grounded = true; }
      if (p.x > canvas.width - 150 && p.y + p.height > floorY) { p.y = floorY - p.height; p.vy = 0; p.grounded = true; }

      let onIce = false;
      let inWater = false;
      let inSlow = false;
      let windForce = 0;
      let floatForce = 0;
      const pFeetX = p.x + p.width / 2;
      const pLeftX = p.x + 2;
      const pRightX = p.x + p.width - 2;
      const pFarRightX = p.x + p.width + 5;
      const pCenterX = p.x + p.width / 2;
      const pCenterY = p.y + p.height / 2;

      // 모든 가능한 표면 수집
      let allSurfaces = [];

      objectsRef.current.forEach(obj => {
        const objCenterX = obj.x + obj.width / 2;
        const objCenterY = obj.y + obj.height / 2;

        // 플레이어와 오브젝트 충돌 체크
        const isOverlapping = p.x < obj.x + obj.width && p.x + p.width > obj.x &&
                              p.y < obj.y + obj.height && p.y + p.height > obj.y;

        // waterEffect: 물 속에서 느리게 움직임 (ghost + waterEffect)
        if (obj.waterEffect && isOverlapping) {
          inWater = true;
        }

        // slowEffect: 거미줄 등 느려지는 효과 (ghost 유지하면서 슬로우)
        if (obj.slowEffect && isOverlapping) {
          inSlow = true;
        }

        // 사다리: 위에서 걷다가 사다리 안으로 떨어지면 내려가기 시작
        if (obj.physics === 'ladder' && isOverlapping) {
          // 사다리 위에 서있다가 사다리 범위 안으로 떨어지면 내려가기
          if (!p.ladderDirection && p.y > obj.y + 5) {
            p.ladderDirection = 'down';
            p.currentLadder = obj;
          }
        }

        // floating: 풍선은 공중에 떠있고, 밟으면 살짝 위로 뜸
        if (obj.physics === 'floating' && isOverlapping) {
          floatForce = -5; // 위로 뜨는 힘 (강화)
        }

        // magnet: 자석에 가까우면 강하게 끌어당김
        if (obj.physics === 'magnet') {
          const dist = Math.sqrt((pCenterX - objCenterX) ** 2 + (pCenterY - objCenterY) ** 2);
          if (dist < 250) { // 자석 영향 범위 확대
            const pullStrength = (250 - dist) / 250 * 8; // 끌림 강도 대폭 증가
            if (pCenterX < objCenterX) p.x += pullStrength;
            else p.x -= pullStrength;
            // 세로 방향으로도 살짝 끌림
            if (pCenterY < objCenterY) p.y += pullStrength * 0.3;
            else p.y -= pullStrength * 0.3;
          }
        }

        // wind: 선풍기 근처에서 왼쪽으로 밀려남
        if (obj.physics === 'wind') {
          const dist = Math.sqrt((pCenterX - objCenterX) ** 2 + (pCenterY - objCenterY) ** 2);
          if (dist < 300) { // 바람 영향 범위 확대
            const pushStrength = (300 - dist) / 300 * 6; // 바람 세기 증가
            // 선풍기 왼쪽으로 밀기
            windForce = -pushStrength;
          }
        }

        // hazard 체크
        if (obj.physics === 'hazard') {
          if (p.x < obj.x + obj.width && p.x + p.width > obj.x &&
              p.y + p.height > obj.y && p.y < obj.y + obj.height) {
            setGameState('lost');
            setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: "아야! 위험한 물체에 닿았어요!" }]);
            return;
          }
        }

        // ghost는 표면 체크 건너뜀
        if (obj.physics !== 'ghost') {
          // 사다리: 올라가는 중이면 통과
          if (obj.physics === 'ladder' && p.ladderDirection === 'up') {
            // 올라가는 중엔 통과
          } else {
            // 여러 지점에서 표면 체크 (앞쪽, 발 중앙, 왼쪽, 오른쪽)
            // getSurfaceHeight가 각 파트별로 X 범위를 체크함
            const checkPoints = [pFeetX, pLeftX, pRightX, pFarRightX];
            for (const checkX of checkPoints) {
              const surfaceY = getSurfaceHeight(obj, checkX);
              if (surfaceY !== null) {
                allSurfaces.push({ y: surfaceY, obj: obj });
              }
            }
          }
        }
      });

      // 플레이어가 밟을 수 있는 가장 높은 표면 찾기
      let bestGroundY = null;
      let bestGroundObj = null;

      for (const surface of allSurfaces) {
        const surfaceY = surface.y;
        const playerBottom = p.y + p.height;
        // 착지 조건: 떨어지는 중이고, 발이 표면 근처에 있으면 착지
        if (p.vy >= 0 && playerBottom >= surfaceY - STEP_HEIGHT && playerBottom <= surfaceY + 10) {
          if (bestGroundY === null || surfaceY < bestGroundY) {
            bestGroundY = surfaceY;
            bestGroundObj = surface.obj;
          }
        }
      }

      if (bestGroundY !== null && bestGroundObj) {
        p.y = bestGroundY - p.height;
        p.vy = 0;
        p.grounded = true;
        if (bestGroundObj.physics === 'bounce') { p.vy = JUMP_FORCE * 1.5; p.grounded = false; }
        if (bestGroundObj.physics === 'ice') onIce = true;
        if (bestGroundObj.physics === 'button') {
          bestGroundObj.pressed = true;
        }
      }

      // 버튼 눌림 상태 리셋 (플레이어가 떠나면)
      for (const obj of objectsRef.current) {
        if (obj.physics === 'button' && obj !== bestGroundObj) {
          obj.pressed = false;
        }
      }

      // 물 속 효과: 느린 움직임 + 느린 낙하
      if (inWater) {
        p.vy *= 0.4; // 물 속 낙하 속도 크게 감소
        p.vx *= 0.6; // 물 속 이동 속도 감소
        // 물 속에서는 점프해서 수영 가능
        p.grounded = true;
      }

      // 슬로우 효과: 거미줄에 걸리면 낙하도 느려짐
      if (inSlow) {
        p.vy *= 0.3; // 낙하 속도 70% 감소
      }

      // 사다리 효과: 오르내리는 중이면 grounded 유지
      if (onLadderEarly) {
        p.grounded = true;
      }

      // 풍선 효과: 위로 떠오름
      if (floatForce !== 0) {
        p.vy = floatForce; // 위로 뜨는 힘 직접 적용
      }

      // 바람 효과: 오른쪽으로 밀림
      if (windForce !== 0) {
        p.x += windForce;
      }

      // 사다리에 실제로 겹쳐있을 때만 멈춤, 벗어나면 앞으로 이동
      if (onLadderEarly) {
        p.vx = 0;
      } else {
        // 땅에 있든 공중에 있든 이동 속도 설정
        if (inSlow) {
          p.vx = PLAYER_SPEED * 0.3; // 거미줄: 느리게 (70% 감소)
        } else if (onIce) {
          p.vx = PLAYER_SPEED * 1.5;
        } else {
          p.vx = PLAYER_SPEED;
        }
      }

      // 떨어지면 게임 오버 (화면 완전히 밖으로 떨어졌을 때)
      if (p.y > canvas.height) {
        setGameState('lost');
        setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: "앗! 떨어졌어요..." }]);
      }
      const goalX = canvas.width - 100;
      if (p.x > goalX && p.y + p.height > floorY - 10 && p.y < floorY + 10) {
        setGameState('won');
        p.vx = 0;
        setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: "축하해요! 목표에 도착했어요!" }]);
      }
    }
  };

  // 우산 직접 그리기 함수
  const drawUmbrella = (ctx, x, y, w, h, color) => {
    const scaleX = w / 100;
    const scaleY = h / 100;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 5;

    // 삼각형 캐노피
    ctx.fillStyle = color || '#1F2937';
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y);
    ctx.lineTo(x + 100 * scaleX, y + 40 * scaleY);
    ctx.lineTo(x, y + 40 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 손잡이 (나무색) - J자 곡선
    ctx.strokeStyle = '#D4A574';
    ctx.lineWidth = 6 * scaleX;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y + 35 * scaleY);
    ctx.lineTo(x + 50 * scaleX, y + 80 * scaleY);
    ctx.quadraticCurveTo(
      x + 50 * scaleX, y + 95 * scaleY,
      x + 35 * scaleX, y + 95 * scaleY
    );
    ctx.stroke();

    ctx.restore();
  };

  // 자석 직접 그리기 함수 (U자 모양)
  const drawMagnet = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    const thickness = 20; // U자 두께

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 5;

    // 빨간색 (왼쪽 다리)
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(x + 5 * scaleX, y);
    ctx.lineTo(x + (5 + thickness) * scaleX, y);
    ctx.lineTo(x + (5 + thickness) * scaleX, y + 50 * scaleY);
    ctx.arc(
      x + 50 * scaleX, y + 50 * scaleY,
      (45 - thickness) * scaleX,
      Math.PI, Math.PI / 2, true
    );
    ctx.lineTo(x + 50 * scaleX, y + 95 * scaleY);
    ctx.arc(
      x + 50 * scaleX, y + 50 * scaleY,
      45 * scaleX,
      Math.PI / 2, Math.PI, false
    );
    ctx.closePath();
    ctx.fill();

    // 파란색 (오른쪽 다리)
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.moveTo(x + 95 * scaleX, y);
    ctx.lineTo(x + (95 - thickness) * scaleX, y);
    ctx.lineTo(x + (95 - thickness) * scaleX, y + 50 * scaleY);
    ctx.arc(
      x + 50 * scaleX, y + 50 * scaleY,
      (45 - thickness) * scaleX,
      0, Math.PI / 2, false
    );
    ctx.lineTo(x + 50 * scaleX, y + 95 * scaleY);
    ctx.arc(
      x + 50 * scaleX, y + 50 * scaleY,
      45 * scaleX,
      Math.PI / 2, 0, true
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // 선풍기 직접 그리기 함수
  const drawFan = (ctx, x, y, w, h, time) => {
    const scaleX = w / 100;
    const scaleY = h / 100;

    const fanCenterX = x + 40 * scaleX;
    const fanCenterY = y + 45 * scaleY;
    const fanRadius = 35 * scaleX;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 5;

    // 받침대
    ctx.fillStyle = '#6B7280';
    ctx.fillRect(x + 60 * scaleX, y + 20 * scaleY, 15 * scaleX, 50 * scaleY);
    ctx.fillRect(x + 55 * scaleX, y + 70 * scaleY, 25 * scaleX, 10 * scaleY);
    ctx.fillStyle = '#374151';
    ctx.fillRect(x + 45 * scaleX, y + 80 * scaleY, 45 * scaleX, 20 * scaleY);

    // 팬 외곽 원
    ctx.fillStyle = '#60A5FA';
    ctx.beginPath();
    ctx.arc(fanCenterX, fanCenterY, fanRadius, 0, Math.PI * 2);
    ctx.fill();

    // 회전하는 날개 3개
    ctx.save();
    ctx.translate(fanCenterX, fanCenterY);
    ctx.rotate(time);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 / 3) * i);
      ctx.fillStyle = '#DBEAFE';
      ctx.beginPath();
      ctx.ellipse(0, -fanRadius * 0.6, fanRadius * 0.22, fanRadius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 팬 중앙 허브
    ctx.fillStyle = '#1E40AF';
    ctx.beginPath();
    ctx.arc(fanCenterX, fanCenterY, fanRadius * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 전등 직접 그리기 함수 (빛이 삼각형으로 아래로 퍼짐)
  const drawLamp = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    // 천장 연결부
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(x + 45 * scaleX, y, 10 * scaleX, 8 * scaleY);

    // 전선
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 3 * scaleX;
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y + 8 * scaleY);
    ctx.lineTo(x + 50 * scaleX, y + 18 * scaleY);
    ctx.stroke();

    // 전구 소켓
    ctx.fillStyle = '#374151';
    ctx.fillRect(x + 40 * scaleX, y + 18 * scaleY, 20 * scaleX, 10 * scaleY);

    // 전구 (원형)
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 35 * scaleY, 12 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 빛 (삼각형으로 아래로 퍼짐)
    ctx.shadowBlur = 0;
    const gradient = ctx.createLinearGradient(x + 50 * scaleX, y + 45 * scaleY, x + 50 * scaleX, y + 100 * scaleY);
    gradient.addColorStop(0, 'rgba(253, 224, 71, 0.8)');
    gradient.addColorStop(0.5, 'rgba(253, 224, 71, 0.4)');
    gradient.addColorStop(1, 'rgba(253, 224, 71, 0.1)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y + 45 * scaleY);
    ctx.lineTo(x + 5 * scaleX, y + 100 * scaleY);
    ctx.lineTo(x + 95 * scaleX, y + 100 * scaleY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // 휴지 직접 그리기 함수
  const drawTissue = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;

    // 휴지 박스
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(x + 10 * scaleX, y + 20 * scaleY, 80 * scaleX, 70 * scaleY);

    // 박스 상단
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(x + 10 * scaleX, y + 20 * scaleY, 80 * scaleX, 10 * scaleY);

    // 휴지 구멍 (상단)
    ctx.fillStyle = '#1E40AF';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scaleX, y + 25 * scaleY, 20 * scaleX, 6 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 휴지 (위로 나온 부분)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x + 35 * scaleX, y + 25 * scaleY);
    ctx.quadraticCurveTo(x + 50 * scaleX, y, x + 65 * scaleX, y + 25 * scaleY);
    ctx.lineTo(x + 60 * scaleX, y + 25 * scaleY);
    ctx.quadraticCurveTo(x + 50 * scaleX, y + 10 * scaleY, x + 40 * scaleX, y + 25 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 휴지 주름
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 45 * scaleX, y + 8 * scaleY);
    ctx.lineTo(x + 45 * scaleX, y + 22 * scaleY);
    ctx.moveTo(x + 55 * scaleX, y + 8 * scaleY);
    ctx.lineTo(x + 55 * scaleX, y + 22 * scaleY);
    ctx.stroke();

    ctx.restore();
  };

  // 물고기 직접 그리기
  const drawFish = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 몸통 (타원)
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.ellipse(x + 55 * scaleX, y + 50 * scaleY, 35 * scaleX, 28 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 꼬리
    ctx.beginPath();
    ctx.moveTo(x + 20 * scaleX, y + 50 * scaleY);
    ctx.lineTo(x, y + 25 * scaleY);
    ctx.lineTo(x, y + 75 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 지느러미
    ctx.fillStyle = '#60A5FA';
    ctx.beginPath();
    ctx.moveTo(x + 55 * scaleX, y + 22 * scaleY);
    ctx.lineTo(x + 45 * scaleX, y + 5 * scaleY);
    ctx.lineTo(x + 65 * scaleX, y + 22 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 눈 (흰자)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x + 75 * scaleX, y + 45 * scaleY, 8 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (동자)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(x + 77 * scaleX, y + 45 * scaleY, 4 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 슬라임 직접 그리기 (물방울 형태)
  const drawSlime = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 몸통 (물방울 형태)
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y + 10 * scaleY);
    ctx.quadraticCurveTo(x + 95 * scaleX, y + 30 * scaleY, x + 90 * scaleX, y + 70 * scaleY);
    ctx.quadraticCurveTo(x + 85 * scaleX, y + 100 * scaleY, x + 50 * scaleX, y + 100 * scaleY);
    ctx.quadraticCurveTo(x + 15 * scaleX, y + 100 * scaleY, x + 10 * scaleX, y + 70 * scaleY);
    ctx.quadraticCurveTo(x + 5 * scaleX, y + 30 * scaleY, x + 50 * scaleX, y + 10 * scaleY);
    ctx.fill();

    // 하이라이트
    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.ellipse(x + 35 * scaleX, y + 40 * scaleY, 12 * scaleX, 18 * scaleY, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (흰자)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x + 35 * scaleX, y + 55 * scaleY, 10 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 65 * scaleX, y + 55 * scaleY, 10 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (동자)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(x + 38 * scaleX, y + 55 * scaleY, 5 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 68 * scaleX, y + 55 * scaleY, 5 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 강아지 직접 그리기
  const drawDog = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 몸통
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.ellipse(x + 55 * scaleX, y + 65 * scaleY, 35 * scaleX, 25 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리
    ctx.beginPath();
    ctx.arc(x + 25 * scaleX, y + 40 * scaleY, 22 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 귀 (왼쪽)
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.ellipse(x + 8 * scaleX, y + 25 * scaleY, 8 * scaleX, 15 * scaleY, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // 귀 (오른쪽)
    ctx.beginPath();
    ctx.ellipse(x + 42 * scaleX, y + 25 * scaleY, 8 * scaleX, 15 * scaleY, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (흰자)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x + 18 * scaleX, y + 38 * scaleY, 6 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 32 * scaleX, y + 38 * scaleY, 6 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (동자)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(x + 19 * scaleX, y + 38 * scaleY, 3 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 33 * scaleX, y + 38 * scaleY, 3 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 코
    ctx.beginPath();
    ctx.arc(x + 25 * scaleX, y + 48 * scaleY, 5 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 다리
    ctx.fillStyle = '#B45309';
    ctx.fillRect(x + 30 * scaleX, y + 82 * scaleY, 10 * scaleX, 18 * scaleY);
    ctx.fillRect(x + 65 * scaleX, y + 82 * scaleY, 10 * scaleX, 18 * scaleY);

    // 꼬리
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.moveTo(x + 90 * scaleX, y + 55 * scaleY);
    ctx.quadraticCurveTo(x + 100 * scaleX, y + 45 * scaleY, x + 95 * scaleX, y + 35 * scaleY);
    ctx.quadraticCurveTo(x + 92 * scaleX, y + 45 * scaleY, x + 85 * scaleX, y + 55 * scaleY);
    ctx.fill();

    ctx.restore();
  };

  // 토끼 직접 그리기
  const drawRabbit = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 귀 (왼쪽) - 흰색
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x + 35 * scaleX, y + 18 * scaleY, 10 * scaleX, 25 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 귀 (오른쪽) - 흰색
    ctx.beginPath();
    ctx.ellipse(x + 65 * scaleX, y + 18 * scaleY, 10 * scaleX, 25 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 귀 안쪽 (분홍)
    ctx.fillStyle = '#FECACA';
    ctx.beginPath();
    ctx.ellipse(x + 35 * scaleX, y + 18 * scaleY, 5 * scaleX, 18 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 65 * scaleX, y + 18 * scaleY, 5 * scaleX, 18 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 몸통
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scaleX, y + 75 * scaleY, 30 * scaleX, 25 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 50 * scaleY, 25 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (흰자)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x + 40 * scaleX, y + 48 * scaleY, 7 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 60 * scaleX, y + 48 * scaleY, 7 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (동자)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(x + 41 * scaleX, y + 48 * scaleY, 4 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 61 * scaleX, y + 48 * scaleY, 4 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 코
    ctx.fillStyle = '#FECACA';
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 58 * scaleY, 4 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 고양이 직접 그리기
  const drawCat = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 몸통
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scaleX, y + 70 * scaleY, 30 * scaleX, 25 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 40 * scaleY, 25 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 귀 (삼각형)
    ctx.beginPath();
    ctx.moveTo(x + 28 * scaleX, y + 25 * scaleY);
    ctx.lineTo(x + 20 * scaleX, y + 5 * scaleY);
    ctx.lineTo(x + 40 * scaleX, y + 20 * scaleY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 72 * scaleX, y + 25 * scaleY);
    ctx.lineTo(x + 80 * scaleX, y + 5 * scaleY);
    ctx.lineTo(x + 60 * scaleX, y + 20 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 귀 안쪽 (분홍)
    ctx.fillStyle = '#FECACA';
    ctx.beginPath();
    ctx.moveTo(x + 28 * scaleX, y + 23 * scaleY);
    ctx.lineTo(x + 24 * scaleX, y + 12 * scaleY);
    ctx.lineTo(x + 36 * scaleX, y + 20 * scaleY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + 72 * scaleX, y + 23 * scaleY);
    ctx.lineTo(x + 76 * scaleX, y + 12 * scaleY);
    ctx.lineTo(x + 64 * scaleX, y + 20 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 눈 (녹색)
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.ellipse(x + 40 * scaleX, y + 38 * scaleY, 6 * scaleX, 8 * scaleY, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 60 * scaleX, y + 38 * scaleY, 6 * scaleX, 8 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 눈동자 (세로 슬릿)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.ellipse(x + 40 * scaleX, y + 38 * scaleY, 2 * scaleX, 6 * scaleY, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 60 * scaleX, y + 38 * scaleY, 2 * scaleX, 6 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 코
    ctx.fillStyle = '#FECACA';
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y + 48 * scaleY);
    ctx.lineTo(x + 46 * scaleX, y + 52 * scaleY);
    ctx.lineTo(x + 54 * scaleX, y + 52 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 수염
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 30 * scaleX, y + 50 * scaleY);
    ctx.lineTo(x + 15 * scaleX, y + 48 * scaleY);
    ctx.moveTo(x + 30 * scaleX, y + 54 * scaleY);
    ctx.lineTo(x + 15 * scaleX, y + 56 * scaleY);
    ctx.moveTo(x + 70 * scaleX, y + 50 * scaleY);
    ctx.lineTo(x + 85 * scaleX, y + 48 * scaleY);
    ctx.moveTo(x + 70 * scaleX, y + 54 * scaleY);
    ctx.lineTo(x + 85 * scaleX, y + 56 * scaleY);
    ctx.stroke();

    // 꼬리
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(x + 80 * scaleX, y + 70 * scaleY);
    ctx.quadraticCurveTo(x + 100 * scaleX, y + 60 * scaleY, x + 95 * scaleX, y + 45 * scaleY);
    ctx.quadraticCurveTo(x + 90 * scaleX, y + 55 * scaleY, x + 75 * scaleX, y + 65 * scaleY);
    ctx.fill();

    ctx.restore();
  };

  // 아이스크림 직접 그리기
  const drawIceCream = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 콘 (이등변 삼각형)
    ctx.fillStyle = '#D2691E';
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y + 100 * scaleY);
    ctx.lineTo(x + 20 * scaleX, y + 45 * scaleY);
    ctx.lineTo(x + 80 * scaleX, y + 45 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 콘 무늬
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 30 * scaleX, y + 50 * scaleY);
    ctx.lineTo(x + 50 * scaleX, y + 90 * scaleY);
    ctx.moveTo(x + 70 * scaleX, y + 50 * scaleY);
    ctx.lineTo(x + 50 * scaleX, y + 90 * scaleY);
    ctx.moveTo(x + 35 * scaleX, y + 60 * scaleY);
    ctx.lineTo(x + 65 * scaleX, y + 60 * scaleY);
    ctx.stroke();

    // 아이스크림 (분홍 - 첫번째 스쿱)
    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 38 * scaleY, 25 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 아이스크림 (핫핑크 - 두번째 스쿱)
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 22 * scaleY, 20 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 아이스크림 (노랑 - 세번째 스쿱)
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 10 * scaleY, 15 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 병아리 직접 그리기
  const drawChick = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 몸통 (타원)
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scaleX, y + 65 * scaleY, 40 * scaleX, 35 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리 (원)
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 30 * scaleY, 28 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (검정)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(x + 38 * scaleX, y + 28 * scaleY, 5 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 62 * scaleX, y + 28 * scaleY, 5 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 부리 (주황 삼각형)
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y + 38 * scaleY);
    ctx.lineTo(x + 42 * scaleX, y + 48 * scaleY);
    ctx.lineTo(x + 58 * scaleX, y + 48 * scaleY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // 닭 직접 그리기
  const drawChicken = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 몸통 (흰색 타원)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x + 45 * scaleX, y + 60 * scaleY, 35 * scaleX, 30 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리 (흰색 원)
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 30 * scaleY, 22 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 볏 (빨간색)
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scaleX, y + 12 * scaleY, 10 * scaleX, 15 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 부리 (주황색 삼각형)
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(x + 72 * scaleX, y + 30 * scaleY);
    ctx.lineTo(x + 90 * scaleX, y + 35 * scaleY);
    ctx.lineTo(x + 72 * scaleX, y + 40 * scaleY);
    ctx.closePath();
    ctx.fill();

    // 눈 (검정)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(x + 55 * scaleX, y + 28 * scaleY, 4 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 턱밑 (빨간색)
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scaleX, y + 48 * scaleY, 8 * scaleX, 5 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 다리 (주황색)
    ctx.fillStyle = '#F97316';
    ctx.fillRect(x + 35 * scaleX, y + 85 * scaleY, 8 * scaleX, 15 * scaleY);
    ctx.fillRect(x + 55 * scaleX, y + 85 * scaleY, 8 * scaleX, 15 * scaleY);

    ctx.restore();
  };

  // 펭귄 직접 그리기
  const drawPenguin = (ctx, x, y, w, h) => {
    const scaleX = w / 100;
    const scaleY = h / 100;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 몸통 (검은색 타원)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scaleX, y + 60 * scaleY, 40 * scaleX, 40 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리 (검은색 원)
    ctx.beginPath();
    ctx.arc(x + 50 * scaleX, y + 25 * scaleY, 25 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 배 (흰색 타원)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scaleX, y + 65 * scaleY, 25 * scaleX, 30 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 눈 (흰색)
    ctx.beginPath();
    ctx.arc(x + 40 * scaleX, y + 22 * scaleY, 8 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 60 * scaleX, y + 22 * scaleY, 8 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 눈동자 (검정)
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(x + 42 * scaleX, y + 22 * scaleY, 4 * scaleX, 0, Math.PI * 2);
    ctx.arc(x + 62 * scaleX, y + 22 * scaleY, 4 * scaleX, 0, Math.PI * 2);
    ctx.fill();

    // 부리 (주황색 삼각형)
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(x + 50 * scaleX, y + 30 * scaleY);
    ctx.lineTo(x + 42 * scaleX, y + 42 * scaleY);
    ctx.lineTo(x + 58 * scaleX, y + 42 * scaleY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // 리본(나비넥타이) 그리기
  const drawRibbon = (ctx, x, y, w, h) => {
    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;

    // 왼쪽 삼각형 날개
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.08, cy - h * 0.15);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(cx - w * 0.08, cy + h * 0.15);
    ctx.closePath();
    ctx.fill();

    // 오른쪽 삼각형 날개
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.08, cy - h * 0.15);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(cx + w * 0.08, cy + h * 0.15);
    ctx.closePath();
    ctx.fill();

    // 왼쪽 하이라이트
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.12, cy);
    ctx.lineTo(x + w * 0.08, y + h * 0.15);
    ctx.lineTo(x + w * 0.08, y + h * 0.85);
    ctx.closePath();
    ctx.fill();

    // 오른쪽 하이라이트
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.12, cy);
    ctx.lineTo(x + w * 0.92, y + h * 0.15);
    ctx.lineTo(x + w * 0.92, y + h * 0.85);
    ctx.closePath();
    ctx.fill();

    // 가운데 매듭
    ctx.fillStyle = '#B91C1C';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.1, h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 말 그리기
  const drawHorse = (ctx, x, y, w, h) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;

    // 몸통
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.45, y + h * 0.55, w * 0.32, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // 목
    ctx.beginPath();
    ctx.moveTo(x + w * 0.65, y + h * 0.45);
    ctx.quadraticCurveTo(x + w * 0.75, y + h * 0.25, x + w * 0.82, y + h * 0.18);
    ctx.lineTo(x + w * 0.88, y + h * 0.22);
    ctx.quadraticCurveTo(x + w * 0.78, y + h * 0.35, x + w * 0.72, y + h * 0.5);
    ctx.closePath();
    ctx.fill();

    // 머리
    ctx.beginPath();
    ctx.ellipse(x + w * 0.88, y + h * 0.15, w * 0.1, h * 0.12, Math.PI * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 코/주둥이
    ctx.fillStyle = '#A0522D';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.95, y + h * 0.18, w * 0.06, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // 귀
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.84, y + h * 0.05);
    ctx.lineTo(x + w * 0.87, y + h * 0.12);
    ctx.lineTo(x + w * 0.81, y + h * 0.1);
    ctx.closePath();
    ctx.fill();

    // 갈기
    ctx.fillStyle = '#4A3728';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.82, y + h * 0.08);
    ctx.quadraticCurveTo(x + w * 0.7, y + h * 0.15, x + w * 0.65, y + h * 0.35);
    ctx.lineTo(x + w * 0.68, y + h * 0.35);
    ctx.quadraticCurveTo(x + w * 0.73, y + h * 0.18, x + w * 0.84, y + h * 0.12);
    ctx.closePath();
    ctx.fill();

    // 앞다리 2개
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + w * 0.58, y + h * 0.68, w * 0.07, h * 0.32);
    ctx.fillRect(x + w * 0.68, y + h * 0.68, w * 0.07, h * 0.32);

    // 뒷다리 2개
    ctx.fillRect(x + w * 0.2, y + h * 0.68, w * 0.07, h * 0.32);
    ctx.fillRect(x + w * 0.3, y + h * 0.68, w * 0.07, h * 0.32);

    // 발굽
    ctx.fillStyle = '#2D1810';
    ctx.fillRect(x + w * 0.58, y + h * 0.95, w * 0.07, h * 0.05);
    ctx.fillRect(x + w * 0.68, y + h * 0.95, w * 0.07, h * 0.05);
    ctx.fillRect(x + w * 0.2, y + h * 0.95, w * 0.07, h * 0.05);
    ctx.fillRect(x + w * 0.3, y + h * 0.95, w * 0.07, h * 0.05);

    // 꼬리
    ctx.fillStyle = '#4A3728';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y + h * 0.5);
    ctx.quadraticCurveTo(x + w * 0.02, y + h * 0.55, x + w * 0.05, y + h * 0.75);
    ctx.quadraticCurveTo(x + w * 0.08, y + h * 0.65, x + w * 0.15, y + h * 0.55);
    ctx.closePath();
    ctx.fill();

    // 눈
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(x + w * 0.86, y + h * 0.13, w * 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 나비 그리기
  const drawButterfly = (ctx, x, y, w, h) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 3;

    const cx = x + w / 2;
    const cy = y + h / 2;

    // 왼쪽 위 날개
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.28, cy, w * 0.28, h * 0.4, -Math.PI * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 오른쪽 위 날개
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.28, cy, w * 0.28, h * 0.4, Math.PI * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 왼쪽 아래 날개
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.2, cy + h * 0.25, w * 0.15, h * 0.2, -Math.PI * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 오른쪽 아래 날개
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.2, cy + h * 0.25, w * 0.15, h * 0.2, Math.PI * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 날개 테두리
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.28, cy, w * 0.28, h * 0.4, -Math.PI * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.28, cy, w * 0.28, h * 0.4, Math.PI * 0.1, 0, Math.PI * 2);
    ctx.stroke();

    // 날개 무늬 (왼쪽 위)
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(cx - w * 0.3, cy - h * 0.1, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - w * 0.22, cy + h * 0.1, w * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 날개 무늬 (오른쪽 위)
    ctx.beginPath();
    ctx.arc(cx + w * 0.3, cy - h * 0.1, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + w * 0.22, cy + h * 0.1, w * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 몸통
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.05, w * 0.06, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.3, w * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // 더듬이 (왼쪽)
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.04, cy - h * 0.35);
    ctx.quadraticCurveTo(cx - w * 0.2, cy - h * 0.55, cx - w * 0.25, cy - h * 0.48);
    ctx.stroke();
    // 더듬이 끝 동그라미
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(cx - w * 0.25, cy - h * 0.48, w * 0.03, 0, Math.PI * 2);
    ctx.fill();

    // 더듬이 (오른쪽)
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.04, cy - h * 0.35);
    ctx.quadraticCurveTo(cx + w * 0.2, cy - h * 0.55, cx + w * 0.25, cy - h * 0.48);
    ctx.stroke();
    // 더듬이 끝 동그라미
    ctx.beginPath();
    ctx.arc(cx + w * 0.25, cy - h * 0.48, w * 0.03, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 음료수 그리기
  const drawDrink = (ctx, x, y, w, h) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;

    // 캔 몸체
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.roundRect(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.8, 5);
    ctx.fill();

    // 캔 상단 (은색)
    ctx.fillStyle = '#9CA3AF';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.15, w * 0.4, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    // 탭
    ctx.fillStyle = '#6B7280';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.12, w * 0.15, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + w * 0.42, y + h * 0.05, w * 0.16, h * 0.07);

    // 라벨 (노란색 띠)
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(x + w * 0.1, y + h * 0.4, w * 0.8, h * 0.3);

    // 라벨 텍스트 효과 (흰색 줄)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + w * 0.15, y + h * 0.5, w * 0.5, h * 0.06);

    // 하이라이트 (반사광)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + w * 0.15, y + h * 0.2, w * 0.1, h * 0.6);

    // 캔 하단 굴곡
    ctx.fillStyle = '#B91C1C';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.95, w * 0.4, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 수박 그리기
  const drawWatermelon = (ctx, x, y, w, h) => {
    ctx.save();

    // 클리핑 영역 설정 (타원 안에만 그리기)
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();

    // 연한 초록색 바탕
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(x, y, w, h);

    // 진한 초록색 세로 줄무늬
    ctx.fillStyle = '#166534';
    const stripeCount = 8;
    const stripeWidth = w / stripeCount;

    for (let i = 0; i < stripeCount; i += 2) {
      // 줄무늬를 약간 구불구불하게
      ctx.beginPath();
      const sx = x + i * stripeWidth;
      ctx.moveTo(sx, y);

      // 위에서 아래로 곡선 줄무늬
      for (let py = 0; py <= h; py += h / 10) {
        const wave = Math.sin(py / h * Math.PI) * stripeWidth * 0.3;
        ctx.lineTo(sx + wave, y + py);
      }

      // 반대편으로 돌아오기
      for (let py = h; py >= 0; py -= h / 10) {
        const wave = Math.sin(py / h * Math.PI) * stripeWidth * 0.3;
        ctx.lineTo(sx + stripeWidth + wave, y + py);
      }

      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // 타원 테두리
    ctx.save();
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 꼭지
    ctx.save();
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.05, w * 0.05, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawCompositeShape = (ctx, obj, x, y, w, h) => {
    // 우산은 별도 함수로 그리기
    if (obj.name === '우산') {
      drawUmbrella(ctx, x, y, w, h, obj.color);
      return;
    }
    // 선풍기는 별도 함수로 그리기 (회전 애니메이션)
    if (obj.name === '선풍기' || obj.physics === 'wind') {
      const time = performance.now() / 500;
      drawFan(ctx, x, y, w, h, time);
      return;
    }
    // 자석은 별도 함수로 그리기
    if (obj.name === '자석' || obj.physics === 'magnet') {
      drawMagnet(ctx, x, y, w, h);
      return;
    }
    // 전등은 별도 함수로 그리기
    if (obj.name === '전등' || obj.name === '램프' || obj.name === '조명') {
      drawLamp(ctx, x, y, w, h);
      return;
    }
    // 휴지는 별도 함수로 그리기
    if (obj.name === '휴지' || obj.name === '티슈' || obj.name === '화장지') {
      drawTissue(ctx, x, y, w, h);
      return;
    }
    // 물고기는 별도 함수로 그리기
    if (obj.name === '물고기') {
      drawFish(ctx, x, y, w, h);
      return;
    }
    // 슬라임은 별도 함수로 그리기
    if (obj.name === '슬라임') {
      drawSlime(ctx, x, y, w, h);
      return;
    }
    // 강아지는 별도 함수로 그리기
    if (obj.name === '강아지') {
      drawDog(ctx, x, y, w, h);
      return;
    }
    // 토끼는 별도 함수로 그리기
    if (obj.name === '토끼') {
      drawRabbit(ctx, x, y, w, h);
      return;
    }
    // 고양이는 별도 함수로 그리기
    if (obj.name === '고양이') {
      drawCat(ctx, x, y, w, h);
      return;
    }
    // 아이스크림은 별도 함수로 그리기
    if (obj.name === '아이스크림') {
      drawIceCream(ctx, x, y, w, h);
      return;
    }
    // 병아리는 별도 함수로 그리기
    if (obj.name === '병아리') {
      drawChick(ctx, x, y, w, h);
      return;
    }
    // 닭은 별도 함수로 그리기
    if (obj.name === '닭') {
      drawChicken(ctx, x, y, w, h);
      return;
    }
    // 펭귄은 별도 함수로 그리기
    if (obj.name === '펭귄') {
      drawPenguin(ctx, x, y, w, h);
      return;
    }
    // 리본(나비넥타이)은 별도 함수로 그리기
    if (obj.name === '리본') {
      drawRibbon(ctx, x, y, w, h);
      return;
    }
    // 말은 별도 함수로 그리기
    if (obj.name === '말') {
      drawHorse(ctx, x, y, w, h);
      return;
    }
    // 나비는 별도 함수로 그리기
    if (obj.name === '나비') {
      drawButterfly(ctx, x, y, w, h);
      return;
    }
    // 음료수는 별도 함수로 그리기
    if (obj.name === '음료수') {
      drawDrink(ctx, x, y, w, h);
      return;
    }
    // 수박은 별도 함수로 그리기
    if (obj.name === '수박') {
      drawWatermelon(ctx, x, y, w, h);
      return;
    }
    if (!obj.parts || obj.parts.length === 0) return;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 5;

    const isAbsoluteCoords = obj.parts.some(p => p.x > 100 || p.w > 100);
    const scaleX = isAbsoluteCoords ? 1 : w / 100;
    const scaleY = isAbsoluteCoords ? 1 : h / 100;

    obj.parts.forEach(part => {
      ctx.fillStyle = part.color || obj.color || '#6B7280';
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      if (part.type === 'rect') {
        const px = x + part.x * scaleX;
        const py = y + part.y * scaleY;
        const pw = part.w * scaleX;
        const ph = part.h * scaleY;
        ctx.rect(px, py, pw, ph);
      } else if (part.type === 'circle') {
        const px = x + part.x * scaleX;
        const py = y + part.y * scaleY;
        const pw = part.w * scaleX;
        const ph = part.h * scaleY;
        ctx.arc(px + pw/2, py + ph/2, pw/2, 0, Math.PI*2);
      } else if (part.type === 'ellipse') {
        // ellipse는 cx, cy, rx, ry 사용
        const cx = x + part.cx * scaleX;
        const cy = y + part.cy * scaleY;
        const rx = part.rx * scaleX;
        const ry = part.ry * scaleY;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else if (part.type === 'triangle') {
        const px = x + part.x * scaleX;
        const py = y + part.y * scaleY;
        const pw = part.w * scaleX;
        const ph = part.h * scaleY;
        ctx.moveTo(px + pw/2, py);
        ctx.lineTo(px + pw, py + ph);
        ctx.lineTo(px, py + ph);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  };

  const drawObject = (ctx, obj, x, y, w, h) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = obj.color || '#6B7280';
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;

    // 이미지 렌더링 타입 처리
    if (obj.renderType === 'image' && obj.imageUrl) {
      if (!objectImagesRef.current[obj.imageUrl]) {
        const img = new Image();
        img.src = obj.imageUrl;
        img.onload = () => {
          objectImagesRef.current[obj.imageUrl] = img;
        };
        objectImagesRef.current[obj.imageUrl] = 'loading';
      }
      const cachedImg = objectImagesRef.current[obj.imageUrl];
      if (cachedImg && cachedImg !== 'loading') {
        ctx.shadowColor = 'transparent';
        ctx.drawImage(cachedImg, x, y, w, h);
        ctx.restore();
        return;
      }
    }

    // 리본 - 커스텀 그리기
    if (obj.name === '리본') {
      const cx = x + w / 2;
      const cy = y + h / 2;

      // 왼쪽 날개
      ctx.fillStyle = obj.color || '#DC2626';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.08, cy - h * 0.1);
      ctx.quadraticCurveTo(x, y, x + w * 0.05, cy);
      ctx.quadraticCurveTo(x, y + h, cx - w * 0.08, cy + h * 0.1);
      ctx.quadraticCurveTo(cx - w * 0.15, cy, cx - w * 0.08, cy - h * 0.1);
      ctx.fill();

      // 오른쪽 날개
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.08, cy - h * 0.1);
      ctx.quadraticCurveTo(x + w, y, x + w * 0.95, cy);
      ctx.quadraticCurveTo(x + w, y + h, cx + w * 0.08, cy + h * 0.1);
      ctx.quadraticCurveTo(cx + w * 0.15, cy, cx + w * 0.08, cy - h * 0.1);
      ctx.fill();

      // 왼쪽 날개 하이라이트
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.22, cy, w * 0.12, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // 오른쪽 날개 하이라이트
      ctx.beginPath();
      ctx.ellipse(x + w * 0.78, cy, w * 0.12, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // 가운데 매듭
      ctx.fillStyle = '#B91C1C';
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.1, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // 매듭 하이라이트
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.02, cy - h * 0.05, w * 0.04, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // 아래로 늘어지는 끈
      ctx.fillStyle = obj.color || '#DC2626';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.08, cy + h * 0.15);
      ctx.quadraticCurveTo(cx - w * 0.15, cy + h * 0.5, cx - w * 0.1, y + h);
      ctx.lineTo(cx - w * 0.02, y + h * 0.85);
      ctx.quadraticCurveTo(cx - w * 0.05, cy + h * 0.3, cx - w * 0.08, cy + h * 0.15);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx + w * 0.08, cy + h * 0.15);
      ctx.quadraticCurveTo(cx + w * 0.15, cy + h * 0.5, cx + w * 0.1, y + h);
      ctx.lineTo(cx + w * 0.02, y + h * 0.85);
      ctx.quadraticCurveTo(cx + w * 0.05, cy + h * 0.3, cx + w * 0.08, cy + h * 0.15);
      ctx.fill();

      ctx.restore();
      return;
    }

    if (obj.shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(x + w/2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    else if (obj.shape === 'arch') {
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.quadraticCurveTo(x + w/2, y - h * 0.6, x + w, y + h);
      ctx.lineTo(x + w, y + h + 10);
      ctx.lineTo(x, y + h + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    else if (obj.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x + w/2, y + h/2, w/2, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
    }
    else if (obj.shape === 'star') {
      // 5각 별
      const cx = x + w / 2;
      const cy = y + h / 2;
      const outerR = w / 2;
      const innerR = outerR * 0.4;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / 2) + (i * Math.PI / 5);
        const px = cx + r * Math.cos(angle);
        const py = cy - r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    else if (obj.shape === 'heart') {
      // 하트 모양
      const cx = x + w / 2;
      const topY = y + h * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, y + h); // 하단 꼭지점
      // 왼쪽 곡선
      ctx.bezierCurveTo(
        x - w * 0.1, y + h * 0.6,
        x - w * 0.1, topY - h * 0.2,
        cx, topY
      );
      // 오른쪽 곡선
      ctx.bezierCurveTo(
        x + w + w * 0.1, topY - h * 0.2,
        x + w + w * 0.1, y + h * 0.6,
        cx, y + h
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    else if (obj.shape === 'rainbow') {
      // 무지개 (7색 아치)
      const rainbowColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
      const cx = x + w / 2;
      const bandWidth = h / 8;

      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      for (let i = 0; i < 7; i++) {
        const outerR = (h - i * bandWidth);
        const innerR = (h - (i + 1) * bandWidth);

        ctx.beginPath();
        ctx.arc(cx, y + h, outerR, Math.PI, 0);
        ctx.arc(cx, y + h, Math.max(0, innerR), 0, Math.PI, true);
        ctx.closePath();
        ctx.fillStyle = rainbowColors[i];
        ctx.fill();
      }
      ctx.restore();
    }
    else if (obj.shape === 'happy') {
      // 기쁨 이모지 (웃는 얼굴)
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = w / 2;

      // 얼굴
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 눈 (검정)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.3, cy - r * 0.15, r * 0.12, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.3, cy - r * 0.15, r * 0.12, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

      // 웃는 입 (곡선)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.05, r * 0.45, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    else if (obj.shape === 'sad') {
      // 슬픔 이모지 (우는 얼굴)
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = w / 2;

      // 얼굴
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 눈 (검정)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.3, cy - r * 0.1, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.3, cy - r * 0.1, r * 0.1, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 눈물 (오른쪽 눈 아래 물방울 하나)
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.3, cy + r * 0.2, r * 0.1, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();

      // 슬픈 입 (아래로 휜 곡선)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.65, r * 0.3, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    else if (obj.shape === 'tube') {
      // 튜브 (도넛 모양, 가운데 빈 공간)
      const cx = x + w / 2;
      const cy = y + h / 2;
      const outerR = w / 2;
      const innerR = outerR * 0.4; // 가운데 구멍 크기

      // 바깥 원
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 가운데 구멍 (배경색으로 뚫기)
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 구멍 테두리
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.stroke();
    }
    else if (obj.shape === 'playbutton') {
      // 재생버튼 (회색 원 + 오른쪽 방향 삼각형)
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = w / 2;

      // 회색 원 배경
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 오른쪽 방향 삼각형
      ctx.fillStyle = '#FFFFFF';
      const triW = r * 0.8;
      const triH = r * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx - triW * 0.3, cy - triH / 2); // 왼쪽 위
      ctx.lineTo(cx + triW * 0.5, cy);             // 오른쪽 중앙
      ctx.lineTo(cx - triW * 0.3, cy + triH / 2); // 왼쪽 아래
      ctx.closePath();
      ctx.fill();
    }
    else if (obj.shape === 'light') {
      // 빛 (반투명 원형 광선, 실체 없음)
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = w / 2;

      // 글로우 효과
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, 'rgba(254, 240, 138, 0.8)');
      gradient.addColorStop(0.5, 'rgba(254, 240, 138, 0.4)');
      gradient.addColorStop(1, 'rgba(254, 240, 138, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    else if (obj.shape === 'lightning') {
      // 번개 (지그재그 모양)
      ctx.fillStyle = obj.color || '#FBBF24';
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y);
      ctx.lineTo(x + w * 0.7, y + h * 0.35);
      ctx.lineTo(x + w * 0.55, y + h * 0.35);
      ctx.lineTo(x + w * 0.75, y + h * 0.65);
      ctx.lineTo(x + w * 0.5, y + h * 0.65);
      ctx.lineTo(x + w * 0.7, y + h);
      ctx.lineTo(x + w * 0.35, y + h * 0.55);
      ctx.lineTo(x + w * 0.5, y + h * 0.55);
      ctx.lineTo(x + w * 0.25, y + h * 0.3);
      ctx.lineTo(x + w * 0.45, y + h * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    else {
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  };

  // 배경 초기화 (구름 생성)
  const initializeBackground = (canvasWidth) => {
    if (backgroundInitializedRef.current) return;

    // 구름 생성 (다양한 크기와 위치)
    const clouds = [];
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: Math.random() * canvasWidth,
        y: 30 + Math.random() * 200,
        width: 80 + Math.random() * 120,
        height: 40 + Math.random() * 40,
        speed: 0.2 + Math.random() * 0.3,
        opacity: 0.6 + Math.random() * 0.4
      });
    }
    cloudsRef.current = clouds;
    backgroundInitializedRef.current = true;
  };

  // 구름 그리기
  const drawCloud = (ctx, x, y, w, h, opacity) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#FFFFFF';

    // 여러 원으로 구름 모양 만들기
    const circles = [
      { cx: 0.25, cy: 0.6, r: 0.3 },
      { cx: 0.5, cy: 0.4, r: 0.4 },
      { cx: 0.75, cy: 0.6, r: 0.3 },
      { cx: 0.35, cy: 0.5, r: 0.35 },
      { cx: 0.65, cy: 0.5, r: 0.35 },
    ];

    circles.forEach(c => {
      ctx.beginPath();
      ctx.arc(x + w * c.cx, y + h * c.cy, Math.min(w, h) * c.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  };

  // 배경 그리기 (그라데이션 하늘 + 구름)
  const drawBackground = (ctx, canvas) => {
    const w = canvas.width;
    const h = canvas.height;

    // 그라데이션 하늘
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#87CEEB');    // 위쪽: 밝은 하늘색
    gradient.addColorStop(0.4, '#5DADE2');  // 중간: 하늘색
    gradient.addColorStop(0.7, '#3498DB');  // 아래쪽: 진한 파란색
    gradient.addColorStop(1, '#2471A3');    // 맨 아래: 더 진한 파란색

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // 배경 초기화 (구름 생성)
    initializeBackground(w);

    // 구름 그리기 & 이동
    cloudsRef.current.forEach(cloud => {
      drawCloud(ctx, cloud.x, cloud.y, cloud.width, cloud.height, cloud.opacity);

      // 구름 이동
      cloud.x -= cloud.speed;

      // 화면 왼쪽을 벗어나면 오른쪽으로 이동
      if (cloud.x + cloud.width < 0) {
        cloud.x = w + Math.random() * 100;
        cloud.y = 30 + Math.random() * 200;
      }
    });

    // 태양 그리기
    ctx.save();
    const sunX = w - 120;
    const sunY = 80;
    const sunRadius = 40;

    // 태양 빛 효과 (글로우)
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.5, sunX, sunY, sunRadius * 2);
    sunGlow.addColorStop(0, 'rgba(255, 236, 139, 0.8)');
    sunGlow.addColorStop(0.5, 'rgba(255, 236, 139, 0.3)');
    sunGlow.addColorStop(1, 'rgba(255, 236, 139, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius * 2, 0, Math.PI * 2);
    ctx.fill();

    // 태양 본체
    ctx.fillStyle = '#FFEC8B';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // 태양 중심 (더 밝게)
    ctx.fillStyle = '#FFF8DC';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 배경 그리기 (그라데이션 하늘 + 구름 + 태양)
    drawBackground(ctx, canvas);

    // 그리드 (planning 모드에서만)
    if (gameState === 'planning') {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 50) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }
    }

    // 바닥 (인벤토리 위쪽에 위치)
    const FLOOR_OFFSET = 130;
    const floorY = canvas.height - FLOOR_OFFSET;

    // 왼쪽 바닥 - 잔디
    ctx.fillStyle = '#4A7C3F';
    ctx.fillRect(0, floorY, 150, 50);
    // 잔디 위쪽 밝은 부분
    ctx.fillStyle = '#5B9A4A';
    ctx.fillRect(0, floorY, 150, 8);
    // 잔디 디테일
    ctx.fillStyle = '#3D6B35';
    for (let i = 0; i < 15; i++) {
      ctx.fillRect(i * 10 + 2, floorY + 8, 2, 5);
    }

    // 오른쪽 바닥 - 잔디 (집 이미지와 동일)
    ctx.fillStyle = '#4A7C3F';
    ctx.fillRect(canvas.width - 150, floorY, 150, 50);
    ctx.fillStyle = '#5B9A4A';
    ctx.fillRect(canvas.width - 150, floorY, 150, 8);
    ctx.fillStyle = '#3D6B35';
    for (let i = 0; i < 15; i++) {
      ctx.fillRect(canvas.width - 150 + i * 10 + 2, floorY + 8, 2, 5);
    }

    // 골인 지점
    const goalX = canvas.width - 110;
    const goalY = canvas.height - FLOOR_OFFSET - 80;

    if (goalImageLoadedRef.current && goalImageRef.current) {
      // 이미지로 골 그리기 (원본 비율 유지)
      const img = goalImageRef.current;
      const aspectRatio = img.width / img.height;
      const goalHeight = 120;
      const goalWidth = goalHeight * aspectRatio;
      // 바닥에 붙도록 위치 조정 (판정은 그대로)
      const drawX = goalX + 40 - goalWidth / 2;
      const drawY = canvas.height - FLOOR_OFFSET - goalHeight + 15;
      ctx.drawImage(
        img,
        drawX, drawY,
        goalWidth, goalHeight
      );
    } else {
      // 이미지 로딩 전 기본 도형
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(goalX + 20, goalY + 30, 40, 40);
      ctx.beginPath();
      ctx.moveTo(goalX + 10, goalY + 30);
      ctx.lineTo(goalX + 40, goalY);
      ctx.lineTo(goalX + 70, goalY + 30);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText("GOAL", goalX + 40, goalY - 10);
    }

    // 오브젝트 그리기
    objectsRef.current.forEach(obj => {
      // 선풍기 바람 효과 시각화 (게임 실행 중일 때)
      if (obj.physics === 'wind' && gameState === 'playing') {
        const windRange = 300;
        const objCenterX = obj.x + obj.width / 2;
        const objCenterY = obj.y + obj.height / 2;

        // 바람 파티클 효과
        ctx.save();
        const time = Date.now() / 100;
        for (let i = 0; i < 8; i++) {
          const offset = (time + i * 40) % windRange;
          const waveY = Math.sin((time + i * 20) * 0.1) * 30;
          const alpha = 1 - (offset / windRange);

          ctx.fillStyle = `rgba(147, 197, 253, ${alpha * 0.6})`;
          ctx.beginPath();
          // 왼쪽으로 날아가는 바람 선
          const lineX = objCenterX - offset - 20;
          const lineY = objCenterY + waveY - 20;
          ctx.ellipse(lineX, lineY, 15 - offset/30, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (obj.parts && obj.parts.length > 0) {
        // 우산 직접 그리기
        if (obj.name === '우산') {
          drawUmbrella(ctx, obj.x, obj.y, obj.width, obj.height, obj.color);
        }
        // 선풍기 회전 효과
        else if (obj.physics === 'wind' || obj.name === '선풍기') {
          const time = performance.now() / 500;
          const scaleX = obj.width / 100;
          const scaleY = obj.height / 100;

          // 팬 중심 위치
          const fanCenterX = obj.x + 40 * scaleX;
          const fanCenterY = obj.y + 45 * scaleY;
          const fanRadius = 35 * scaleX;

          // 받침대 그리기
          ctx.fillStyle = '#6B7280';
          ctx.fillRect(obj.x + 60 * scaleX, obj.y + 20 * scaleY, 15 * scaleX, 50 * scaleY);
          ctx.fillRect(obj.x + 55 * scaleX, obj.y + 70 * scaleY, 25 * scaleX, 10 * scaleY);
          ctx.fillStyle = '#374151';
          ctx.fillRect(obj.x + 45 * scaleX, obj.y + 80 * scaleY, 45 * scaleX, 20 * scaleY);

          // 팬 외곽 원
          ctx.fillStyle = '#60A5FA';
          ctx.beginPath();
          ctx.arc(fanCenterX, fanCenterY, fanRadius, 0, Math.PI * 2);
          ctx.fill();

          // 회전하는 날개 3개
          ctx.save();
          ctx.translate(fanCenterX, fanCenterY);
          ctx.rotate(time);
          for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.rotate((Math.PI * 2 / 3) * i);
            ctx.fillStyle = '#DBEAFE';
            ctx.beginPath();
            ctx.ellipse(0, -fanRadius * 0.6, fanRadius * 0.22, fanRadius * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();

          // 팬 중앙 허브
          ctx.fillStyle = '#1E40AF';
          ctx.beginPath();
          ctx.arc(fanCenterX, fanCenterY, fanRadius * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
        // 버튼 눌림 효과: 눌렸을 때 빨간 버튼 부분이 아래로 내려감
        else if (obj.physics === 'button' && obj.pressed) {
          const pressedParts = obj.parts.map((part, idx) => {
            if (idx === 1) { // 빨간 버튼 부분 (두 번째 파트)
              return { ...part, y: part.y + 25 }; // 아래로 내려감
            }
            return part;
          });
          const pressedObj = { ...obj, parts: pressedParts };
          drawCompositeShape(ctx, pressedObj, obj.x, obj.y, obj.width, obj.height);
        } else {
          drawCompositeShape(ctx, obj, obj.x, obj.y, obj.width, obj.height);
        }
      } else {
        drawObject(ctx, obj, obj.x, obj.y, obj.width, obj.height);
      }
    });

    // 배치 미리보기
    if (gameState === 'planning' && selectedSlot !== null) {
      const item = inventory[selectedSlot];
      if (item) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        const previewX = mousePos.x - item.width / 2;
        const previewY = mousePos.y - item.height / 2;
        if (item.parts && item.parts.length > 0) {
          drawCompositeShape(ctx, item, previewX, previewY, item.width, item.height);
        } else {
          drawObject(ctx, item, previewX, previewY, item.width, item.height);
        }
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(previewX, previewY, item.width, item.height);
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("[우클릭: 취소]", mousePos.x, mousePos.y - item.height/2 - 10);
        ctx.restore();
      }
    }

    // 플레이어 (스프라이트 이미지)
    const p = playerRef.current;
    const { x, y, cycle } = p;

    if (spriteLoadedRef.current && spriteRef.current) {
      // 현재 상태에 따라 프레임 선택
      let frames = SPRITE_FRAMES.idle;
      let useLadderSprite = false;
      let useWalkSprite = false;

      if (p.ladderDirection) {
        frames = SPRITE_FRAMES.ladder;
        useLadderSprite = true;
      } else if (!p.grounded && p.vy < 0) {
        frames = SPRITE_FRAMES.jump;
      } else if (!p.grounded && p.vy > 0) {
        frames = SPRITE_FRAMES.fall;
      } else if (p.vx !== 0) {
        frames = SPRITE_FRAMES.walk;
        useWalkSprite = true;
      }

      // 프레임 인덱스 계산
      const frameIndex = Math.floor(cycle) % frames.length;
      const frame = frames[frameIndex];

      // 캐릭터 그리기 크기 (보이는 크기만, 판정은 그대로)
      const drawHeight = 100;
      const drawWidth = (frame.w / frame.h) * drawHeight;
      // 스프라이트 그리기 위치 (충돌 판정 X, 화면 표시용)
      const charCenterX = x + 10;
      const drawX = charCenterX - drawWidth / 2;
      // 스프라이트 Y 그리기 위치 (충돌 판정 X, 화면 표시용)
      const drawY = y + 100 - drawHeight + 10;

      // 사다리 모션은 ladder.png 사용
      if (useLadderSprite && ladderSpriteLoadedRef.current && ladderSpriteRef.current) {
        ctx.drawImage(
          ladderSpriteRef.current,
          frame.x, frame.y, frame.w, frame.h,
          drawX, drawY, drawWidth, drawHeight
        );
      } else if (useWalkSprite && walkSpriteLoadedRef.current && walkSpriteRef.current) {
        // 걷기 모션은 walk.png 사용
        ctx.drawImage(
          walkSpriteRef.current,
          frame.x, frame.y, frame.w, frame.h,
          drawX, drawY, drawWidth, drawHeight
        );
      } else {
        // idle, jump, fall은 character.png 사용
        ctx.drawImage(
          spriteRef.current,
          frame.x, frame.y, frame.w, frame.h,
          drawX, drawY, drawWidth, drawHeight
        );
      }

    } else {
      // 로딩 중 - 간단한 플레이스홀더
      ctx.fillStyle = '#6B7B5E';
      ctx.beginPath();
      ctx.arc(x + 10, y + 25, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x, y + 30, 20, 20);
    }
  };

  const loop = useCallback(() => {
    update();
    draw();
    if (gameState === 'playing') {
      playerRef.current.cycle += 0.08;
    }
    requestRef.current = requestAnimationFrame(loop);
  }, [gameState, selectedSlot, mousePos, inventory]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop]);

  // 캔버스 리사이즈 핸들러
  useEffect(() => {
    if (screen !== 'game') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      canvas.width = rect.width;
      canvas.height = rect.height;

      // 플레이어 초기 위치 업데이트 (인벤토리 위쪽)
      const FLOOR_OFFSET = 130;
      if (gameState === 'planning') {
        playerRef.current.x = 50;
        playerRef.current.y = canvas.height - FLOOR_OFFSET - 100;
      }
    };

    // 약간의 딜레이 후 리사이즈 (DOM이 완전히 렌더링된 후)
    const timer = setTimeout(resizeCanvas, 50);
    window.addEventListener('resize', resizeCanvas);

    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resizeCanvas);
      resizeObserver.disconnect();
    };
  }, [screen, gameState]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseMove = (e) => {
    setMousePos(getCanvasCoords(e));
  };

  const InventoryIcon = ({ item }) => {
    const iconCanvasRef = useRef(null);
    useEffect(() => {
      if (!iconCanvasRef.current) return;
      const ctx = iconCanvasRef.current.getContext('2d');
      const w = iconCanvasRef.current.width;
      const h = iconCanvasRef.current.height;
      ctx.clearRect(0, 0, w, h);

      const scale = Math.min(w / item.width, h / item.height) * 0.8;
      const drawW = item.width * scale;
      const drawH = item.height * scale;
      const drawX = (w - drawW) / 2;
      const drawY = (h - drawH) / 2;

      if (item.parts && item.parts.length > 0) {
        drawCompositeShape(ctx, item, drawX, drawY, drawW, drawH);
      } else {
        drawObject(ctx, item, drawX, drawY, drawW, drawH);
      }
    }, [item]);
    return <canvas ref={iconCanvasRef} width={64} height={64} className="w-full h-full object-contain" />;
  };

  // 게임 시작 함수
  const startGame = (mode) => {
    setSelectedMode(mode);
    if (mode === 'ai' && !apiKey) {
      setShowSettings(true);
    }
    setMessages([
      { id: 1, role: 'ai', text: mode === 'ai'
        ? "AI 모드 활성화! 무엇이든 만들어드릴게요."
        : "기본 모드입니다. 프리셋 오브젝트를 사용해보세요!"
      },
      { id: 2, role: 'ai', text: "자동차, 상자, 다리, 계단, 나무, 집, 로봇 등을 만들 수 있어요." }
    ]);
    setScreen('game');
  };

  // 메뉴 화면
  if (screen === 'menu') {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden" style={{ maxHeight: '100dvh' }}>
        {/* 배경 효과 */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        {/* 로고 */}
        <div className="relative z-10 text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center font-black text-4xl shadow-2xl shadow-purple-500/30">
              L
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-wider text-white mb-2">LOGOS</h1>
          <p className="text-slate-400 text-lg">말로 만드는 퍼즐 플랫포머</p>
        </div>

        {/* 모드 선택 */}
        <div className="relative z-10 flex flex-col gap-4 w-80">
          {/* 기본 모드 */}
          <button
            onClick={() => startGame('basic')}
            className="group relative bg-slate-900 border-2 border-slate-700 hover:border-yellow-500 rounded-xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-yellow-500/10"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <Box size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">기본 모드</h2>
                <p className="text-sm text-slate-400">프리셋 오브젝트 사용</p>
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-yellow-500 transition-colors">
              <Play size={24} />
            </div>
          </button>

          {/* AI 모드 */}
          <button
            onClick={() => startGame('ai')}
            className="group relative bg-slate-900 border-2 border-slate-700 hover:border-purple-500 rounded-xl p-6 text-left transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">AI 모드</h2>
                <p className="text-sm text-slate-400">Gemini AI로 무한한 창작</p>
              </div>
            </div>
            {apiKey && (
              <div className="absolute top-2 right-2 bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                API 연결됨
              </div>
            )}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-purple-500 transition-colors">
              <Play size={24} />
            </div>
          </button>
        </div>

        {/* 하단 정보 */}
        <div className="relative z-10 mt-12 text-center">
          <p className="text-slate-600 text-sm">© 2024 LOGOS Game</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row w-screen h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none" style={{ maxHeight: '100dvh' }}>
      {/* 설정 모달 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-96 max-w-[90vw]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Key size={20} className="text-purple-400" />
                API 설정
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-800 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Gemini API 키</label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="API 키를 입력하세요"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <p>1. Google AI Studio 접속 (aistudio.google.com)</p>
                <p>2. API 키 발급 (무료)</p>
                <p>3. 위에 붙여넣기</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setTempApiKey(''); saveApiKey(); }}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
                >
                  기본 모드
                </button>
                <button
                  onClick={saveApiKey}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 게임 영역 */}
      <div className="flex-1 relative border-r border-slate-800 flex flex-col min-w-0 min-h-0">
        <div className="absolute top-4 left-4 z-10 flex gap-4">
          <div className="bg-slate-900/90 px-4 py-2 rounded-lg backdrop-blur-md border border-slate-700 shadow-lg flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-inner">L</div>
            <div>
              <h1 className="text-sm font-bold text-slate-200 tracking-wider">LOGOS</h1>
              <div className={`text-[10px] ${isAIMode ? 'text-green-400' : 'text-yellow-400'}`}>
                {isAIMode ? 'AI MODE' : 'BASIC MODE'}
              </div>
            </div>
          </div>
          <div className="bg-slate-900/90 px-4 py-2 rounded-lg backdrop-blur-md border border-slate-700 shadow-lg flex items-center gap-3">
            <Coins className="text-yellow-400" size={20} />
            <div>
              <div className="text-xs text-slate-400 font-bold">TOKENS</div>
              <div className="text-lg font-mono font-bold text-yellow-400 leading-none">
                {tokens} <span className="text-xs text-slate-500">/ {MAX_TOKENS}</span>
              </div>
            </div>
          </div>
          <button
            onClick={resetGame}
            className="bg-slate-900/90 px-4 py-2 rounded-lg backdrop-blur-md border border-slate-700 shadow-lg flex items-center gap-2 hover:bg-slate-800 hover:border-slate-600 transition-colors"
            title="리셋"
          >
            <RotateCcw className="text-slate-400" size={20} />
            <span className="text-sm text-slate-300 font-bold">RESET</span>
          </button>
        </div>

        <div className="flex-1 relative bg-slate-900 cursor-crosshair min-h-0">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ imageRendering: 'auto' }}
            onClick={handleCanvasClick}
            onContextMenu={handleCanvasContextMenu}
            onMouseMove={handleMouseMove}
          />
          {(gameState === 'won' || gameState === 'lost') && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col z-50 backdrop-blur-sm">
              <h1 className={`text-5xl font-black mb-4 drop-shadow-2xl ${gameState === 'won' ? 'text-green-500' : 'text-red-500'}`}>
                {gameState === 'won' ? 'SUCCESS!' : 'FAILED...'}
              </h1>
              <button
                onClick={resetGame}
                className="px-10 py-4 bg-white text-black text-xl font-bold rounded-lg hover:bg-slate-200 transition-transform hover:scale-105"
              >
                다시 시작
              </button>
            </div>
          )}
        </div>

        <div className="h-28 bg-slate-900 border-t border-slate-800 p-2 flex flex-col justify-center items-center relative z-20">
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 text-xs text-slate-500 font-bold tracking-widest">
            INVENTORY ({inventory.length}/{MAX_INVENTORY})
          </div>
          <div className="flex gap-2">
            {[...Array(MAX_INVENTORY)].map((_, idx) => {
              const item = inventory[idx];
              const isSelected = selectedSlot === idx;
              return (
                <div
                  key={idx}
                  onClick={() => item && setSelectedSlot(isSelected ? null : idx)}
                  className={`w-16 h-16 rounded-md border flex items-center justify-center relative cursor-pointer transition-all overflow-hidden ${
                    isSelected
                      ? 'border-purple-500 bg-purple-900/20 shadow-[0_0_10px_rgba(168,85,247,0.5)] scale-105'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                  } ${!item ? 'opacity-30' : 'opacity-100'} group`}
                >
                  {item ? (
                    <>
                      <div className="w-full h-full flex items-center justify-center p-1">
                        <InventoryIcon item={item} />
                      </div>
                      <div className="absolute bottom-0 w-full text-[9px] bg-black/60 text-center text-white truncate px-1">
                        {item.name}
                      </div>
                      <button
                        onClick={(e) => handleDeleteItem(idx, e)}
                        className="absolute top-0 right-0 p-0.5 bg-red-900/80 hover:bg-red-600 text-white rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="버리기"
                      >
                        <X size={10} />
                      </button>
                    </>
                  ) : (
                    <div className="text-slate-600 text-[10px] font-mono">{idx + 1}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 채팅 패널 */}
      <div className="w-full md:w-80 bg-slate-950 border-l border-slate-800 flex flex-col shadow-2xl relative z-30 min-h-0 max-h-full">
        <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                isAIMode
                  ? 'bg-gradient-to-br from-purple-600 to-blue-600'
                  : 'bg-gradient-to-br from-yellow-600 to-orange-600'
              }`}>
                <PenTool size={20} className="text-white" />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                isAIMode ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
            </div>
            <div>
              <div className="font-bold text-sm text-white">
                {isAIMode ? 'AI Generator' : 'Basic Generator'}
              </div>
              <div className={`text-xs font-mono ${isAIMode ? 'text-purple-400' : 'text-yellow-400'}`}>
                {isAIMode ? 'Gemini Powered' : 'Preset Mode'}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => { setTempApiKey(apiKey); setShowSettings(true); }}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
              title="설정"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={resetGame}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
              title="리셋"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-950/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-md border ${
                msg.role === 'user'
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-100 rounded-br-none'
                  : 'bg-slate-800 border-slate-700 text-slate-300 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start">
              <div className="bg-slate-800 rounded-xl px-4 py-3 border border-slate-700">
                <span className="animate-pulse">생성 중...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleSendMessage} className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={isAIMode ? "무엇이든 만들어보세요!" : "자동차, 상자, 다리 등..."}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-4 pr-12 py-6 focus:outline-none focus:border-purple-500 text-base text-white"
              disabled={gameState !== 'planning' || isTyping}
            />
            <button
              type="submit"
              disabled={gameState !== 'planning' || isTyping}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </form>
          <button
            onClick={() => {
              setGameState('playing');
              playerRef.current.vx = PLAYER_SPEED;
            }}
            disabled={gameState !== 'planning'}
            className={`w-full mt-3 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all border border-transparent ${
              gameState === 'planning'
                ? 'bg-green-600/20 text-green-400 border-green-500/50 hover:bg-green-600/30'
                : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
            }`}
          >
            <Play size={16} fill="currentColor" />
            {gameState === 'planning' ? 'START' : 'RUNNING...'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogosGame;
