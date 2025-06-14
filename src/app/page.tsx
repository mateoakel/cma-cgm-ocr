'use client'

import { jsPDF } from 'jspdf'
import { useEffect, useState } from 'react'

declare global {
  interface Window {
    gtag: (
      type: 'event',
      eventName: 'conversion',
      eventParams: {
        send_to: string
      },
    ) => void
  }
}

const gtag_report_conversion = () => {
  window.gtag('event', 'conversion', {
    send_to: 'AW-11490839090/zsTRCJnqo9oaELKUoecq',
  })
  return false
}

export default function InvoiceUpload() {
  // State variables to store form data and status
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [processingStatus, setProcessingStatus] = useState('')

  useEffect(() => {
    gtag_report_conversion()
  }, [])

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

  // Handle file selection (allows multiple files)
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (selectedFiles) {
      // Convert FileList to Array for easier manipulation
      setFiles(Array.from(selectedFiles))
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

      setProcessingStatus('Preparing to send individual requests...')

      // Create individual payloads (one per file) - COMPLETELY INDEPENDENT
      const individualPayloads = filesData.map(fileData => ({
        // Same structure for every request
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        submissionTime: new Date().toISOString(), // Each gets its own timestamp
        
        // Individual file data (different for each request)
        fileName: fileData.name,
        fileSize: fileData.size,
        fileType: fileData.type,
        fileContent: fileData.content,
        originalFileName: fileData.originalName,
        originalFileType: fileData.originalType,
        convertedToPdf: fileData.convertedToPdf,
        
        // Metadata - each file is completely independent
        uploadedAt: new Date().toISOString()
      }))

      setProcessingStatus('Sending individual requests to create separate items...')

      console.log(`🚀 Sending ${individualPayloads.length} independent requests`)
      console.log('📦 Each request is completely independent with same structure:')
      individualPayloads.forEach((payload, index) => {
        console.log(`   - Request ${index + 1}:`, {
          ...payload,
          fileContent: payload.fileContent ? `${payload.fileContent.substring(0, 50)}...` : 'null'
        })
      })

      try {
        // Send ALL requests simultaneously using Promise.all - each one completely independent
        const responses = await Promise.all(
          individualPayloads.map(payload =>
            fetch('https://mateo17.app.n8n.cloud/webhook-test/aabbb372-024b-478e-9e4b-55180ba0f540', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            })
          )
        )

        console.log(`📡 All ${responses.length} requests completed`)

        // Check if all requests were successful
        const allSuccessful = responses.every(response => response.ok)
        const successCount = responses.filter(response => response.ok).length

        if (allSuccessful) {
          console.log('✅ All requests successful!')
          setSubmitStatus('success')
          setErrorMessage(`✅ Successfully sent ${successCount} files as separate items! Each file will appear as a separate item in your n8n workflow.`)
          
          // Reset form after successful submission
          setFirstName('')
          setLastName('')
          setFiles([])
          // Reset file input
          const fileInput = document.getElementById('file-input') as HTMLInputElement
          if (fileInput) fileInput.value = ''
        } else {
          console.error(`❌ ${responses.length - successCount} requests failed`)
          setSubmitStatus('error')
          setErrorMessage(`Partial success: ${successCount}/${responses.length} files uploaded. Check console for details.`)
        }
      } catch (error) {
        console.error('❌ Network error:', error)
        setSubmitStatus('error')
        setErrorMessage(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-6 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent mb-3">
            Document Upload
          </h1>
          <p className="text-lg text-gray-600 max-w-md mx-auto leading-relaxed">
            Upload your documents and we&apos;ll convert them to PDF format for processing
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 p-8 transition-all duration-300 hover:shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="firstName" className="block text-sm font-semibold text-gray-800">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400"
                placeholder="Enter your first name"
                required
              />
            </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="block text-sm font-semibold text-gray-800">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400"
                placeholder="Enter your last name"
                required
              />
            </div>
            </div>

            {/* File Upload Input */}
            <div className="space-y-4">
              <label htmlFor="file-input" className="block text-sm font-semibold text-gray-800">
                Upload Documents *
              </label>
              <div className="relative">
              <input
                type="file"
                id="file-input"
                multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={handleFileChange}
                  className="w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 file:mr-4 file:py-2 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-blue-500 file:to-indigo-500 file:text-white hover:file:from-blue-600 hover:file:to-indigo-600 file:shadow-lg hover:file:shadow-xl file:transition-all file:duration-200 bg-gradient-to-br from-gray-50 to-blue-50/30"
                required
              />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-sm text-gray-600 font-medium">
                      Drop files here or click to browse
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Supports PDF, JPG, PNG, GIF, BMP, WebP • Images automatically converted to PDF</span>
              </div>
            </div>

            {/* Selected Files Display */}
            {files.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-200/50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-lg">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">
                    Selected Files ({files.length})
                </h4>
                </div>
                <div className="space-y-3">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/40 transition-all duration-200 hover:bg-white/80">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 truncate max-w-xs">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.type}</p>
                        </div>
                        {file.type !== 'application/pdf' && (
                          <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 text-xs font-semibold rounded-full border border-blue-200">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            → PDF
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-700">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-100/50 rounded-xl p-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">All files will be converted to PDF format before upload</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-300 transform ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed scale-95 text-white'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-500/50'
              }`}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing Documents...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Upload & Process Documents</span>
                </div>
              )}
            </button>

            {/* Processing Status */}
            {processingStatus && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200/50 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl">
                    <div className="w-6 h-6 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                  </div>
                  <div>
                    <p className="text-blue-900 font-semibold text-lg">Processing</p>
                    <p className="text-blue-800 text-sm">
                      {processingStatus}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Status Messages */}
            {submitStatus === 'success' && (
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200/50 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl">
                    <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-emerald-900 font-bold text-lg">Success!</p>
                    <p className="text-emerald-800 text-sm">
                      {errorMessage || 'Your documents have been uploaded and processed successfully.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200/50 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl flex-shrink-0">
                    <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-red-900 font-bold text-lg">Upload Failed</p>
                    <p className="text-red-800 text-sm mb-2">
                      {errorMessage || 'Something went wrong. Please try again.'}
                    </p>
                    <p className="text-red-600 text-xs bg-red-100/50 rounded-lg p-2">
                      💡 Tip: Check the browser console (F12) for detailed error information.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-8 space-y-4">
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure Processing</span>
            </div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Auto PDF Conversion</span>
            </div>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Encrypted Transfer</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">
            Your documents are automatically converted to PDF format and securely transmitted using industry-standard encryption protocols.
          </p>
        </div>
      </div>
    </div>
    </>
  )
}
