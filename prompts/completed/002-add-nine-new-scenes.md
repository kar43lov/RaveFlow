<objective>
Добавить 9 новых визуальных сцен в Rave Visualizer для расширения функционала с 6 до 15 сцен.

Каждая сцена должна быть уникальной, креативной и реагировать на аудио/биты. Сцены используют разные стили: 2D, 3D, абстрактные, фигуративные, игровые.
</objective>

<context>
Проект: WebGL визуализатор для клубов/рейвов с аудио-реактивностью.
Стек: Vite + React + TypeScript + Three.js + Zustand

Существующие 6 сцен:
1. Vortex Tunnel - неоновый туннель с полосами
2. Grid Corridor - wireframe коридор
3. Neon Maze Chase - лабиринт сверху
4. Pixel Symbol Tunnel - пиксельные символы летят к камере
5. Crowd Pulse - силуэты толпы с DJ
6. Laser Storm - лазеры и частицы

@src/scenes/types.ts - интерфейс Scene
@src/scenes/LaserStorm.ts - пример реализации сцены
@src/renderer/SceneManager.ts - регистрация сцен
@CLAUDE.md - архитектура проекта
</context>

<new_scenes>
Реализуй эти 9 новых сцен:

## Сцена 7: Bouncing Ball (2D игровой стиль)
- Мячик(и) летают по экрану, отскакивая от границ
- При ударе о границу - вспышка света
- На бит - мячик ускоряется или добавляется новый
- Траектории оставляют неоновые следы
- Параметры: количество мячей, цвет, скорость

## Сцена 8: Running Man (2D стиль RHCP - Can't Stop)
- Силуэт бегущего человека в профиль (простая геометрия)
- Бесконечный бег на месте с параллаксом фона
- На бит - прыжок или смена позы
- Ретро/пиксельный стиль или неоновый контур
- Параметры: скорость бега, цвет силуэта

## Сцена 9: DJ Booth Strobe
- Силуэт DJ за пультом в центре
- Вращающиеся прожекторы вокруг
- Стробоскоп синхронизирован с битом
- Дымка/туман эффект
- Параметры: интенсивность стробоскопа, угол прожекторов

## Сцена 10: Pong Battle
- Классический Pong: две ракетки, мячик
- ИИ играет сам с собой
- На бит - ускорение или визуальный эффект
- Неоновый ретро-стиль
- Параметры: скорость игры, цвета команд

## Сцена 11: Waveform Ocean
- 3D волны как океан или эквалайзер
- Высота волн реагирует на bass/mid/high
- Камера летит над волнами
- Градиентные неоновые цвета
- Параметры: плотность волн, амплитуда

## Сцена 12: Particle Explosion
- Центральный взрыв частиц на каждый бит
- Частицы разлетаются и затухают
- Между битами - медленное вращение/дрейф
- Разные формы взрывов (сфера, диск, спираль)
- Параметры: количество частиц, форма взрыва

## Сцена 13: Geometric Morph
- Геометрические 3D фигуры (куб → сфера → пирамида)
- Плавная трансформация между формами
- На бит - переход к следующей форме
- Wireframe + solid с glow
- Параметры: скорость морфа, цвет

## Сцена 14: Kaleidoscope
- Калейдоскопический эффект с симметрией
- Паттерны генерируются процедурно
- Вращение и пульсация на аудио
- Психоделические цвета
- Параметры: количество сегментов, скорость вращения

## Сцена 15: City Flythrough
- Пролёт через неоновый город (как в фильме TRON)
- Здания как простые геометрические блоки
- Неоновые контуры и вывески
- Скорость движения на audio.energy
- Параметры: плотность зданий, высота

</new_scenes>

<implementation>
Для каждой сцены:

1. Создай файл `./src/scenes/[SceneName].ts`
2. Реализуй интерфейс Scene из types.ts
3. Используй Three.js и/или GLSL шейдеры
4. Реагируй на beat.isOnset, audio.bass, audio.energy

Паттерн аудио-реактивности:
```typescript
update(time, deltaTime, beat, audio) {
  if (beat.isOnset) {
    this.pulse = 1.0  // триггер на бит
  }
  this.pulse *= 0.9  // затухание

  // Непрерывная реакция
  this.material.uniforms.uBass.value = audio.bass
  this.material.uniforms.uEnergy.value = audio.energy
}
```

Структура шейдера (если нужен):
```glsl
uniform float uTime;
uniform float uPulse;
uniform float uBass;
uniform float uEnergy;
uniform float uColorHue;
```

Обязательно реализуй:
- getParameters() - настраиваемые параметры
- setParameter() - применение параметров
- dispose() - очистка GPU ресурсов
- resize() - адаптация к размеру экрана
</implementation>

<registration>
После создания всех сцен, обнови `./src/renderer/SceneManager.ts`:

```typescript
import { BouncingBall } from '../scenes/BouncingBall'
import { RunningMan } from '../scenes/RunningMan'
// ... остальные импорты

// В init():
this.scenes = [
  // существующие 6 сцен
  new VortexTunnel(),
  new GridCorridor(),
  new NeonMazeChase(),
  new PixelSymbolTunnel(),
  new CrowdPulse(),
  new LaserStorm(),
  // новые 9 сцен
  new BouncingBall(),
  new RunningMan(),
  new DJBoothStrobe(),
  new PongBattle(),
  new WaveformOcean(),
  new ParticleExplosion(),
  new GeometricMorph(),
  new Kaleidoscope(),
  new CityFlythrough()
]
```
</registration>

<output>
Создать файлы:
- `./src/scenes/BouncingBall.ts`
- `./src/scenes/RunningMan.ts`
- `./src/scenes/DJBoothStrobe.ts`
- `./src/scenes/PongBattle.ts`
- `./src/scenes/WaveformOcean.ts`
- `./src/scenes/ParticleExplosion.ts`
- `./src/scenes/GeometricMorph.ts`
- `./src/scenes/Kaleidoscope.ts`
- `./src/scenes/CityFlythrough.ts`

Изменить:
- `./src/renderer/SceneManager.ts` - добавить импорты и регистрацию
</output>

<verification>
После создания всех файлов:
1. Запусти `npm run build` для проверки TypeScript
2. Исправь любые ошибки компиляции
3. Убедись что все 15 сцен регистрируются в SceneManager
</verification>

<success_criteria>
- Все 9 новых сцен созданы и реализуют интерфейс Scene
- Каждая сцена имеет уникальный визуальный стиль
- Все сцены реагируют на аудио (beat.isOnset, audio.bass/energy)
- Каждая сцена имеет настраиваемые параметры
- SceneManager обновлён с 15 сценами
- Проект компилируется без ошибок (`npm run build`)
- README.md обновлён с описанием новых сцен
</success_criteria>
