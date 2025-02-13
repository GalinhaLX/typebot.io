import { DashboardFolder } from 'db'
import {
  Flex,
  Heading,
  HStack,
  Portal,
  Skeleton,
  Stack,
  useEventListener,
  useToast,
  Wrap,
} from '@chakra-ui/react'
import { useTypebotDnd } from 'contexts/TypebotDndContext'
import { useUser } from 'contexts/UserContext'
import React, { useState } from 'react'
import { createFolder, useFolders } from 'services/folders'
import {
  patchTypebot,
  TypebotInDashboard,
  useTypebots,
} from 'services/typebots'
import { useSharedTypebotsCount } from 'services/user/sharedTypebots'
import { BackButton } from './FolderContent/BackButton'
import { CreateBotButton } from './FolderContent/CreateBotButton'
import { CreateFolderButton } from './FolderContent/CreateFolderButton'
import { ButtonSkeleton, FolderButton } from './FolderContent/FolderButton'
import { SharedTypebotsButton } from './FolderContent/SharedTypebotsButton'
import { TypebotButton } from './FolderContent/TypebotButton'
import { TypebotCardOverlay } from './FolderContent/TypebotButtonOverlay'
import { OnboardingModal } from './OnboardingModal'

type Props = { folder: DashboardFolder | null }

const dragDistanceTolerance = 20

export const FolderContent = ({ folder }: Props) => {
  const { user } = useUser()
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const {
    setDraggedTypebot,
    draggedTypebot,
    mouseOverFolderId,
    setMouseOverFolderId,
  } = useTypebotDnd()
  const [mouseDownPosition, setMouseDownPosition] = useState({ x: 0, y: 0 })
  const [draggablePosition, setDraggablePosition] = useState({ x: 0, y: 0 })
  const [relativeDraggablePosition, setRelativeDraggablePosition] = useState({
    x: 0,
    y: 0,
  })
  const [typebotDragCandidate, setTypebotDragCandidate] =
    useState<TypebotInDashboard>()

  const toast = useToast({
    position: 'top-right',
    status: 'error',
  })
  const {
    folders,
    isLoading: isFolderLoading,
    mutate: mutateFolders,
  } = useFolders({
    parentId: folder?.id,
    onError: (error) => {
      toast({ title: "Couldn't fetch folders", description: error.message })
    },
  })

  const {
    typebots,
    isLoading: isTypebotLoading,
    mutate: mutateTypebots,
  } = useTypebots({
    folderId: folder?.id,
    onError: (error) => {
      toast({ title: "Couldn't fetch typebots", description: error.message })
    },
  })

  const { totalSharedTypebots } = useSharedTypebotsCount({
    userId: folder === null ? user?.id : undefined,
    onError: (error) => {
      toast({
        title: "Couldn't fetch shared typebots",
        description: error.message,
      })
    },
  })

  const moveTypebotToFolder = async (typebotId: string, folderId: string) => {
    if (!typebots) return
    const { error } = await patchTypebot(typebotId, {
      folderId: folderId === 'root' ? null : folderId,
    })
    if (error) toast({ description: error.message })
    mutateTypebots({ typebots: typebots.filter((t) => t.id !== typebotId) })
  }

  const handleCreateFolder = async () => {
    if (!folders) return
    setIsCreatingFolder(true)
    const { error, data: newFolder } = await createFolder({
      parentFolderId: folder?.id ?? null,
    })
    setIsCreatingFolder(false)
    if (error)
      return toast({ title: 'An error occured', description: error.message })
    if (newFolder) mutateFolders({ folders: [...folders, newFolder] })
  }

  const handleTypebotDeleted = (deletedId: string) => {
    if (!typebots) return
    mutateTypebots({ typebots: typebots.filter((t) => t.id !== deletedId) })
  }

  const handleFolderDeleted = (deletedId: string) => {
    if (!folders) return
    mutateFolders({ folders: folders.filter((f) => f.id !== deletedId) })
  }

  const handleFolderRenamed = (folderId: string, name: string) => {
    if (!folders) return
    mutateFolders({
      folders: folders.map((f) => (f.id === folderId ? { ...f, name } : f)),
    })
  }

  const handleMouseUp = async () => {
    if (mouseOverFolderId !== undefined && draggedTypebot)
      await moveTypebotToFolder(draggedTypebot.id, mouseOverFolderId ?? 'root')
    setTypebotDragCandidate(undefined)
    setMouseOverFolderId(undefined)
    setDraggedTypebot(undefined)
  }
  useEventListener('mouseup', handleMouseUp)

  const handleMouseDown =
    (typebot: TypebotInDashboard) => (e: React.MouseEvent) => {
      const element = e.currentTarget as HTMLDivElement
      const rect = element.getBoundingClientRect()
      setDraggablePosition({ x: rect.left, y: rect.top })
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setRelativeDraggablePosition({ x, y })
      setMouseDownPosition({ x: e.screenX, y: e.screenY })
      setTypebotDragCandidate(typebot)
    }

  const handleMouseMove = (e: MouseEvent) => {
    if (!typebotDragCandidate) return
    const { clientX, clientY, screenX, screenY } = e
    if (
      Math.abs(mouseDownPosition.x - screenX) > dragDistanceTolerance ||
      Math.abs(mouseDownPosition.y - screenY) > dragDistanceTolerance
    )
      setDraggedTypebot(typebotDragCandidate)
    setDraggablePosition({
      ...draggablePosition,
      x: clientX - relativeDraggablePosition.x,
      y: clientY - relativeDraggablePosition.y,
    })
  }
  useEventListener('mousemove', handleMouseMove)

  return (
    <Flex w="full" flex="1" justify="center">
      {typebots && user && folder === null && (
        <OnboardingModal totalTypebots={typebots.length} />
      )}
      <Stack w="1000px" spacing={6}>
        <Skeleton isLoaded={folder?.name !== undefined}>
          <Heading as="h1">{folder?.name}</Heading>
        </Skeleton>
        <Stack>
          <HStack>
            {folder && <BackButton id={folder.parentFolderId} />}
            <CreateFolderButton
              onClick={handleCreateFolder}
              isLoading={isCreatingFolder || isFolderLoading}
            />
          </HStack>
          <Wrap spacing={4}>
            <CreateBotButton
              folderId={folder?.id}
              isLoading={isTypebotLoading}
              isFirstBot={typebots?.length === 0 && folder === null}
            />
            {totalSharedTypebots > 0 && <SharedTypebotsButton />}
            {isFolderLoading && <ButtonSkeleton />}
            {folders &&
              folders.map((folder) => (
                <FolderButton
                  key={folder.id.toString()}
                  folder={folder}
                  onFolderDeleted={() => handleFolderDeleted(folder.id)}
                  onFolderRenamed={(newName: string) =>
                    handleFolderRenamed(folder.id, newName)
                  }
                />
              ))}
            {isTypebotLoading && <ButtonSkeleton />}
            {typebots &&
              typebots.map((typebot) => (
                <TypebotButton
                  key={typebot.id.toString()}
                  typebot={typebot}
                  onTypebotDeleted={() => handleTypebotDeleted(typebot.id)}
                  onMouseDown={handleMouseDown(typebot)}
                />
              ))}
          </Wrap>
        </Stack>
      </Stack>
      {draggedTypebot && (
        <Portal>
          <TypebotCardOverlay
            typebot={draggedTypebot}
            onMouseUp={handleMouseUp}
            pos="fixed"
            top="0"
            left="0"
            style={{
              transform: `translate(${draggablePosition.x}px, ${draggablePosition.y}px) rotate(-2deg)`,
            }}
          />
        </Portal>
      )}
    </Flex>
  )
}
