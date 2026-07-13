interface NarrativeInput {
  content: string;
  index: number;
}

const speakers = [
  { speaker: '阿澄', role: '好奇的新手', avatar: '澄' },
  { speaker: '木木', role: '擅长举例', avatar: '木' },
  { speaker: '小栖', role: '温柔补充', avatar: '栖' },
] as const;

export function createDialogueBeat(input: NarrativeInput) {
  const person = speakers[input.index % speakers.length];
  return {
    ...person,
    message: input.index % 2 === 0 ? `我试着用一句话说：${input.content}` : `等一下，这里值得划一下——${input.content}`,
    sourceText: input.content,
  };
}

const scenes = ['傍晚的旧书店', '下雨的社团教室', '开往海边的慢车', '星光下的屋顶'] as const;
const characters = ['凛', '夏野', '遥', '千寻'] as const;

export function createGalgameBeat(input: NarrativeInput) {
  return {
    scene: scenes[input.index % scenes.length],
    character: characters[input.index % characters.length],
    dialogue: `“如果把今天发现的线索写下来……”\n${input.content}`,
    sourceText: input.content,
  };
}
