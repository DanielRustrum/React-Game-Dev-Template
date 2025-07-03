import { spritesheet } from "@engine/graphics.sprite"
import { Slider } from "@ui/slider"

import test_sheet from '@assets/sprites/Pink_Monster_Idle_4.png'
import { memo, useRef, useState } from "react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@ui/resizable"
import { BackToDemoMenu } from "@/components/Game/BackToDemo"

const [Sprite, { modifier }] = spritesheet(test_sheet, {
    tile_size: [32, 32],
    frame_time: .25,
    structure: {
        "main": { type: "animated", layer: 0, length: 4 },
        "tile": { type: "tile", layer: 0, length: 4 },
    }
})



export const RateAnimated = memo(() => {
    const [rate, setRate] = useState(1)

    return <div className="flex gap-10">
        <p className="text-m font-bold">Change Animation Rate: </p>
        <Sprite state="main" rate={rate} />
        <Slider
            defaultValue={[1]}
            min={0}
            max={2}
            step={.1}
            className="w-50"
            onValueChange={value => {
                if (value[0] !== rate) setRate(value[0]);
            }}
        />
        <p>{rate}</p>
    </div>
})

export const ScaleAnimated = memo(() => {
    const [scale, setScale] = useState(1)

    return <div className="flex gap-10 items-center">
        <p className="text-m font-bold">Change Scale: </p>
        <Sprite state="main" scale={scale} />
        <Slider
            defaultValue={[1]}
            min={.5}
            max={5}
            step={.1}
            className="w-50"
            onValueChange={value => {
                if (value[0] !== scale) setScale(value[0]);
            }}
        />
        <p>{scale}</p>
    </div>
})

export const ScaleStatic = memo(() => {
    const [scale, setScale] = useState(1)

    return <div className="flex gap-10 items-center">
        <p className="text-m font-bold">Change Scale: </p>
        <Sprite state="tile" scale={scale} />
        <Slider
            defaultValue={[1]}
            min={.5}
            max={5}
            step={.1}
            className="w-50"
            onValueChange={value => {
                if (value[0] !== scale) setScale(value[0]);
            }}
        />
        <p>{scale}</p>
    </div>
})

export const HueChangeStatic = memo(() => {
    const [hue, setHue] = useState(0)

    return <div className="flex gap-10 items-center">
        <p className="text-m font-bold">Change Hue: </p>
        <Sprite state="tile" style={{ filter: `hue-rotate(${hue}deg)` }} />
        <Slider
            defaultValue={[0]}
            min={0}
            max={360}
            step={1}
            className="w-50"
            onValueChange={value => {
                if (value[0] !== hue) setHue(value[0]);
            }}
        />
        <p>{hue}</p>
    </div>
})

export const ResizeAnimated = () => {
    const Element_Ref = useRef(document.createElement("div"))

    return (
        <>
            <p className="text-m font-bold">Resizes to Container: </p>
            <ResizablePanelGroup
                direction="vertical"
                className="min-h-[200px] max-w-md rounded-lg border md:min-w-[450px]"
            >
                <ResizablePanel defaultSize={25}>
                    <p>Resize the container to resize the sprite.</p>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={75} >
                    <div className="h-full" ref={Element_Ref}>
                        <Sprite state="main" resizeTo={Element_Ref} />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </>
    )
}

setTimeout(() => {
    modifier("test", (ctx, width, height) => {
        const imageData = ctx.getImageData(0, 0, width, height)
        const data = imageData.data

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]

            if (r > 110 && b > 200 && g < 100) {
                data[i] = 60
                data[i + 1] = 80
                data[i + 2] = 70
            }
        }

        ctx.putImageData(imageData, 0, 0)
    })
}, 2000)

export const ShaderExample = () => {
    return <div className="flex gap-10 items-center">
        <p className="text-m font-bold">Shader: </p>
        <Sprite state="main" use_modifier="test" scale={3}>
            <div className="w-full h-full flex justify-center items-center"><p>Spinner</p></div>
        </Sprite>
        <Sprite state="main" use_modifier="test" scale={3}>
            <div className="w-full h-full flex justify-center items-center"><p>Spinner</p></div>
        </Sprite>
    </div>
}

export const AnimationExample = () => {
    return <div className="flex gap-10 items-center">
        <style>{`
            @keyframes bounce {
                0% {
                    filter: hue-rotate(0deg);
                }
                100% {
                    filter: hue-rotate(360deg);
                }
            }`}
        </style>
        <p className="text-m font-bold">Added CSS Animation: </p>
        <Sprite state="main" animation="bounce 10s ease-in-out infinite" scale={3} />
    </div>
}

export const Panel = () => <div className="m-10">
    <BackToDemoMenu />
    <p className="text-xl font-bold text-center">Animation</p>
    <Sprite state="main" />
    <Sprite state="main" place_in_background scale={4}>
        <div className="text-center flex flex-col justify-center h-full text-white bg-black opacity-50 rounded-3xl">Background Animation</div>
    </Sprite>
    <RateAnimated />
    <ScaleAnimated />
    <p className="text-xl font-bold text-center">Static</p>
    <Sprite state="tile" tile={2} />
    <ScaleStatic />
    <HueChangeStatic />
    <ResizeAnimated />
    <ShaderExample />
    <AnimationExample />
</div>

export const name = "sprite"
