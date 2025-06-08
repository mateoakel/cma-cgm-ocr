'use client'

import { jsPDF } from 'jspdf'
import { useState } from 'react'

export default function InvoiceUpload() {
  // State variables to store form data and status
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [processingStatus, setProcessingStatus] = useState('')

  // Convert file to PDF, then to base64 string
  const convertFileToPdfBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      // If file is already a PDF, just convert to base64
      if (file.type === 'application/pdf') {
        reader.readAsDataURL(file)
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const base64 = reader.result.split(',')[1]
            resolve(base64)
          } else {
            reject(new Error('Failed to convert PDF to base64'))
          }
        }
        reader.onerror = error => reject(error)
        return
      }
      
      // For image files, convert to PDF first
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file)
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            try {
              // Create new jsPDF instance
              const pdf = new jsPDF()
              
              // Create an image element to get dimensions
              const img = new Image()
              img.onload = () => {
                // Calculate dimensions to fit the image on the PDF page
                const pageWidth = pdf.internal.pageSize.getWidth()
                const pageHeight = pdf.internal.pageSize.getHeight()
                
                // Calculate scaling to fit image on page while maintaining aspect ratio
                const imgWidth = img.width
                const imgHeight = img.height
                const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight)
                
                const scaledWidth = imgWidth * ratio
                const scaledHeight = imgHeight * ratio
                
                // Center the image on the page
                const x = (pageWidth - scaledWidth) / 2
                const y = (pageHeight - scaledHeight) / 2
                
                // Add image to PDF
                pdf.addImage(reader.result as string, 'JPEG', x, y, scaledWidth, scaledHeight)
                
                // Convert PDF to base64
                const pdfBase64 = pdf.output('datauristring').split(',')[1]
                resolve(pdfBase64)
              }
              img.onerror = () => reject(new Error('Failed to load image'))
              img.src = reader.result as string
            } catch (error) {
              reject(new Error(`Failed to create PDF: ${error}`))
            }
          } else {
            reject(new Error('Failed to read file'))
          }
        }
        reader.onerror = error => reject(error)
        return
      }
      
      // For other file types, reject (or you could handle them differently)
      reject(new Error(`Unsupported file type: ${file.type}`))
    })
  }

  // Convert file to base64 string (keeping the old function for reference)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data:mime/type;base64, prefix
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        } else {
          reject(new Error('Failed to convert file to base64'))
        }
      }
      reader.onerror = error => reject(error)
    })
  }

  // Handle file selection (allows multiple files)
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (selectedFiles) {
      // Convert FileList to Array for easier manipulation
      setFiles(Array.from(selectedFiles))
    }
  }

  // Test webhook with just name data (no files)
  const testWebhook = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      alert('Please fill in both first and last name to test.')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      console.log('Testing webhook with JSON data...')
      
      const testData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        test: true
      }

      // First try POST with JSON
      console.log('Trying POST with JSON...')
      let response = await fetch('https://mateo17.app.n8n.cloud/webhook-test/aabbb372-024b-478e-9e4b-55180ba0f540', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      })

      console.log('POST JSON response status:', response.status)
      
      // If POST fails, try GET with query parameters
      if (!response.ok) {
        console.log('POST failed, trying GET with query parameters...')
        const params = new URLSearchParams({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          test: 'true'
        })
        
        response = await fetch(`https://mateo17.app.n8n.cloud/webhook-test/aabbb372-024b-478e-9e4b-55180ba0f540?${params}`, {
          method: 'GET',
        })
        console.log('GET response status:', response.status)
      }

      // If GET also fails, try POST with form data
      if (!response.ok) {
        console.log('GET failed, trying POST with FormData...')
        const formData = new FormData()
        formData.append('firstName', firstName.trim())
        formData.append('lastName', lastName.trim())
        formData.append('test', 'true')
        
        response = await fetch('https://mateo17.app.n8n.cloud/webhook-test/aabbb372-024b-478e-9e4b-55180ba0f540', {
          method: 'POST',
          body: formData,
        })
        console.log('POST FormData response status:', response.status)
      }
      
      if (response.ok) {
        const responseData = await response.text()
        console.log('Test success:', responseData)
        setSubmitStatus('success')
        setErrorMessage('✅ Webhook connection successful! Method working.')
      } else {
        const errorText = await response.text()
        console.error('All methods failed. Last error:', errorText)
        setErrorMessage(`All connection methods failed. Status: ${response.status}. This might be a CORS issue or the webhook configuration needs adjustment.`)
        setSubmitStatus('error')
      }
    } catch (error) {
      console.error('Test error:', error)
      setErrorMessage(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}. This might be a network or CORS issue.`)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault() // Prevent default form submission behavior
    
    // Validate that we have all required data
    if (!firstName.trim() || !lastName.trim() || files.length === 0) {
      alert('Please fill in all fields and select at least one file.')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')
    setProcessingStatus('Converting files...')

    try {
      console.log('Sending data to webhook...')
      console.log('First Name:', firstName.trim())
      console.log('Last Name:', lastName.trim())
      console.log('Number of files:', files.length)

      // Convert all files to base64
      console.log('Converting files to base64...')
      
      // Check total file size and warn if too large
      const totalSize = files.reduce((sum, file) => sum + file.size, 0)
      const totalSizeMB = totalSize / 1024 / 1024
      console.log(`Total file size: ${totalSizeMB.toFixed(2)} MB`)
      
      if (totalSizeMB > 10) {
        console.warn('Warning: Large file size may cause upload issues')
      }
      
      setProcessingStatus(`Converting ${files.length} file(s) to PDF and encoding to base64...`)
      const filesData = await Promise.all(
        files.map(async (file, index) => {
          setProcessingStatus(`Converting file ${index + 1} of ${files.length}: ${file.name} → PDF`)
          try {
            const base64Content = await convertFileToPdfBase64(file)
            return {
              name: file.name.replace(/\.[^/.]+$/, '.pdf'), // Change extension to .pdf
              originalName: file.name,
              originalSize: file.size,
              originalType: file.type,
              size: base64Content.length, // Size of the base64 string
              type: 'application/pdf', // All files are now PDFs
              lastModified: file.lastModified,
              content: base64Content,
              index: index,
              convertedToPdf: true
            }
          } catch (error) {
            console.error(`Error converting file ${file.name}:`, error)
            return {
              name: file.name,
              originalName: file.name,
              originalSize: file.size,
              originalType: file.type,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
              content: null,
              error: `Failed to convert file: ${error instanceof Error ? error.message : 'Unknown error'}`,
              index: index,
              convertedToPdf: false
            }
          }
        })
      )

      setProcessingStatus('Sending data to webhook...')

      // Create comprehensive data object
      const submissionData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        submissionTime: new Date().toISOString(),
        fileCount: files.length,
        files: filesData,
        metadata: {
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          totalSize: files.reduce((sum, file) => sum + file.size, 0)
        }
      }

      console.log('Sending comprehensive data with files...')
      console.log('Data being sent:', {
        ...submissionData,
        files: submissionData.files.map(f => ({
          ...f,
          content: f.content ? `${f.content.substring(0, 100)}...` : 'null'
        }))
      })

      let response: Response

      // Try POST with JSON (includes actual file content as base64)
      console.log('Trying POST with JSON including file content...')
      response = await fetch('https://mateo17.app.n8n.cloud/webhook-test/aabbb372-024b-478e-9e4b-55180ba0f540', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      })

      console.log('POST JSON response status:', response.status)
      
      // Log the actual response text to see what's wrong
      if (!response.ok) {
        const errorText = await response.text()
        console.error('POST JSON failed with error:', errorText)
      }

      // Only proceed if JSON method succeeded - no fallbacks that lose file content
      if (!response.ok) {
        const errorText = await response.text()
        console.error('POST JSON method failed - no fallback will be used to preserve file content:', errorText)
        throw new Error(`Failed to upload files with base64 content. Status: ${response.status}. Error: ${errorText}`)
      }

      if (response.ok) {
        const responseData = await response.text()
        console.log('Success response:', responseData)
        setSubmitStatus('success')
        setErrorMessage('✅ Successfully submitted! Your invoices and data have been sent to the webhook.')
        // Reset form after successful submission
        setFirstName('')
        setLastName('')
        setFiles([])
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        const errorText = await response.text()
        console.error('All methods failed. Error response:', errorText)
        setErrorMessage(`All submission methods failed. Status: ${response.status}. Please check your n8n webhook configuration.`)
        setSubmitStatus('error')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      setErrorMessage(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}. This might be a CORS or connectivity issue.`)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
      setProcessingStatus('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Invoice Upload
          </h1>
          <p className="text-gray-600">
            Please provide your information and upload your invoices
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* First Name Input */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your first name"
                required
              />
            </div>

            {/* Last Name Input */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your last name"
                required
              />
            </div>

            {/* Test Webhook Button */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                🧪 Test Connection First
              </h4>
              <p className="text-xs text-yellow-700 mb-3">
                Click this button to test if the webhook is working before uploading files
              </p>
              <button
                type="button"
                onClick={testWebhook}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {isSubmitting ? 'Testing...' : 'Test Webhook Connection'}
              </button>
            </div>

            {/* File Upload Input */}
            <div>
              <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-2">
                Upload Invoices *
              </label>
              <input
                type="file"
                id="file-input"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Select multiple files (PDF, JPG, PNG, GIF, BMP, WebP) - images will be converted to PDF
              </p>
            </div>

            {/* Selected Files Display */}
            {files.length > 0 && (
              <div className="bg-gray-50 rounded-md p-3">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Selected Files ({files.length}):
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {files.map((file, index) => (
                    <li key={index} className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="truncate">{file.name}</span>
                        {file.type !== 'application/pdf' && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            → PDF
                          </span>
                        )}
                      </div>
                      <span className="text-gray-400 ml-2">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  📄 All files will be converted to PDF format before upload
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              } text-white`}
            >
              {isSubmitting ? 'Processing...' : 'Submit Invoice Data'}
            </button>

            {/* Processing Status */}
            {processingStatus && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-blue-800 text-sm font-medium">
                  ⚙️ {processingStatus}
                </p>
              </div>
            )}

            {/* Status Messages */}
            {submitStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-green-800 text-sm font-medium">
                  {errorMessage || '✅ Successfully submitted! Your data has been sent to the webhook.'}
                </p>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm font-medium">
                  ❌ {errorMessage || 'Something went wrong. Please try again.'}
                </p>
                <p className="text-red-600 text-xs mt-2">
                  Check the browser console (F12) for detailed error information.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Your data is securely processed and sent to our system.</p>
        </div>
      </div>
    </div>
  )
}
