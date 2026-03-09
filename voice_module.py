import speech_recognition as sr
import edge_tts
import asyncio
import os

def transcribe_audio(audio_path: str) -> str:
    """Converts audio file to text using SpeechRecognition (Google Web Speech API)."""
    import speech_recognition as sr
    from pydub import AudioSegment
    import os
    
    recognizer = sr.Recognizer()
    try:
        if not os.path.exists(audio_path):
            return "Audio file not found."
            
        process_path = audio_path
        
        # Try to convert to standard wav format required by SpeechRecognition
        try:
            audio = AudioSegment.from_file(audio_path)
            temp_wav = audio_path + "_converted.wav"
            audio.export(temp_wav, format="wav")
            process_path = temp_wav
        except Exception as e:
            print(f"pydub conversion skipped (ffmpeg might be missing): {e}")

        with sr.AudioFile(process_path) as source:
            # We can use offset/duration or record the whole file. 
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            
        if process_path != audio_path and os.path.exists(process_path):
            os.remove(process_path)
            
        return text
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        return ""

async def text_to_speech(text: str, voice: str = 'en-US-AriaNeural', output_path: str = "output.mp3") -> str:
    """Converts text to high quality speech using Microsoft Edge TTS."""
    try:
        print(f"🎙️ Generating AI Voice ({voice}) for text: {text[:30]}...")
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        print(f"✅ Audio file saved at: {output_path}")
        return output_path
    except Exception as e:
        print(f"❌ Error generating speech: {e}")
        return ""


