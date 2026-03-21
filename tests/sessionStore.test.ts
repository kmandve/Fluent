import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../src/store/sessionStore'

describe('sessionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useSessionStore.getState().resetSession()
  })

  it('has correct default state values', () => {
    const state = useSessionStore.getState()
    expect(state.isListening).toBe(false)
    expect(state.transcript).toEqual([])
    expect(state.interimText).toBe('')
    expect(state.energyLevel).toBe(0)
    expect(state.errorState).toBe('none')
  })

  it('setListening(true) sets isListening to true', () => {
    useSessionStore.getState().setListening(true)
    expect(useSessionStore.getState().isListening).toBe(true)
  })

  it('setListening(false) sets isListening to false', () => {
    useSessionStore.getState().setListening(true)
    useSessionStore.getState().setListening(false)
    expect(useSessionStore.getState().isListening).toBe(false)
  })

  it('addFinalTranscript appends entry with correct shape', () => {
    useSessionStore.getState().addFinalTranscript('hello world')
    const { transcript } = useSessionStore.getState()
    expect(transcript).toHaveLength(1)
    expect(transcript[0].text).toBe('hello world')
    expect(transcript[0].isFinal).toBe(true)
    expect(typeof transcript[0].id).toBe('string')
    expect(typeof transcript[0].timestamp).toBe('number')
  })

  it('transcript buffer keeps max 50 entries (51st push drops oldest)', () => {
    // Add 51 entries
    for (let i = 0; i < 51; i++) {
      useSessionStore.getState().addFinalTranscript(`entry ${i}`)
    }
    const { transcript } = useSessionStore.getState()
    expect(transcript).toHaveLength(50)
    // The oldest entry (entry 0) should be dropped; entry 1 should be first
    expect(transcript[0].text).toBe('entry 1')
    expect(transcript[49].text).toBe('entry 50')
  })

  it('setInterimText updates interimText', () => {
    useSessionStore.getState().setInterimText('hel')
    expect(useSessionStore.getState().interimText).toBe('hel')
  })

  it('addFinalTranscript clears interimText', () => {
    useSessionStore.getState().setInterimText('hel')
    useSessionStore.getState().addFinalTranscript('hello')
    expect(useSessionStore.getState().interimText).toBe('')
  })

  it('setEnergyLevel updates energyLevel', () => {
    useSessionStore.getState().setEnergyLevel(0.05)
    expect(useSessionStore.getState().energyLevel).toBe(0.05)
  })

  it('setErrorState updates errorState', () => {
    useSessionStore.getState().setErrorState('mic-denied')
    expect(useSessionStore.getState().errorState).toBe('mic-denied')
  })

  it('resetSession clears all state back to defaults', () => {
    // Set some state
    useSessionStore.getState().setListening(true)
    useSessionStore.getState().addFinalTranscript('some text')
    useSessionStore.getState().setInterimText('some interim')
    useSessionStore.getState().setEnergyLevel(0.8)
    useSessionStore.getState().setErrorState('mic-denied')

    // Reset
    useSessionStore.getState().resetSession()

    const state = useSessionStore.getState()
    expect(state.isListening).toBe(false)
    expect(state.transcript).toEqual([])
    expect(state.interimText).toBe('')
    expect(state.energyLevel).toBe(0)
    expect(state.errorState).toBe('none')
  })
})
