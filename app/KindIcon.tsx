import { DocItemKind } from './DocModel.server'
import {
  VscJson,
  VscSymbolClass,
  VscSymbolEnum,
  VscSymbolField,
  VscSymbolInterface,
  VscSymbolMethod,
  VscSymbolProperty,
  VscSymbolVariable,
} from 'react-icons/vsc'

export function KindIcon(props: { kind: DocItemKind; static?: boolean }) {
  let icon = null
  let color = 'text-gray-400'
  switch (props.kind) {
    case 'EntryPoint':
    case 'Namespace':
    case 'Package':
      icon = <VscJson />
      break
    case 'Class':
      icon = <VscSymbolClass />
      color = 'text-orange-400'
      break
    case 'Constructor':
    case 'ConstructSignature':
      icon = <VscSymbolProperty />
      break
    case 'TypeAlias':
      icon = <VscSymbolProperty />
      color = 'text-orange-400'
      break
    case 'Enum':
      icon = <VscSymbolEnum />
      color = 'text-orange-400'
      break
    case 'Interface':
      icon = <VscSymbolInterface />
      color = 'text-sky-400'
      break
    case 'Function':
    case 'Method':
    case 'MethodSignature':
      icon = <VscSymbolMethod />
      if (!props.static) color = 'text-purple-400'
      break
    case 'Property':
    case 'PropertySignature':
      icon = <VscSymbolField />
      if (!props.static) color = 'text-sky-400'
      break
    case 'Variable':
      icon = <VscSymbolVariable />
      color = 'text-sky-400'
      break
    default:
      icon = <span title={props.kind}></span>
  }
  return (
    <span
      className={`inline-block align-middle w-[1.25em] relative top-[-0.1em] ${color}`}
    >
      {icon}
    </span>
  )
}
